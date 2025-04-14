import { ObjectOptions, StoreProvider, StoreProviderConfig } from './base';
import { toBuffer, toStr } from 'libs/shared/str';
import { Pool } from 'pg';
import { isEmpty } from 'lodash';
import { createLogger, Logger } from 'libs/server/debugging';

/**
 * PostgreSQL存储提供者配置
 */
export interface PostgreSQLConfig extends StoreProviderConfig {
    connectionString: string;
}

/**
 * PostgreSQL存储提供者实现
 */
export class StorePostgreSQL extends StoreProvider {
    pool: Pool;
    config: PostgreSQLConfig;
    logger: Logger;

    constructor(config: PostgreSQLConfig) {
        super(config);
        this.logger = createLogger('store.postgresql');
        this.pool = new Pool({
            connectionString: config.connectionString,
        });
        this.config = config;
        
        // 初始化数据库模式
        this.initSchema().catch(err => {
            this.logger.error(err, '初始化数据库模式失败');
        });
    }

    /**
     * 初始化数据库模式
     */
    private async initSchema() {
        try {
          // 内联SQL模式，避免依赖外部文件
          const schema = `
          CREATE TABLE IF NOT EXISTS objects (
              path TEXT PRIMARY KEY,
              content BYTEA NOT NULL,
              content_type TEXT,
              is_compressed BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS object_metadata (
              path TEXT NOT NULL,
              key TEXT NOT NULL,
              value TEXT NOT NULL,
              PRIMARY KEY (path, key),
              FOREIGN KEY (path) REFERENCES objects(path) ON DELETE CASCADE
          );
          
          CREATE TABLE IF NOT EXISTS object_headers (
              path TEXT NOT NULL,
              header_type TEXT NOT NULL,
              value TEXT NOT NULL,
              PRIMARY KEY (path, header_type),
              FOREIGN KEY (path) REFERENCES objects(path) ON DELETE CASCADE
          );
          `;
          
          const client = await this.pool.connect();
          try {
            await client.query(schema);
            this.logger.info('数据库模式初始化成功');
          } catch (err) {
            // 检查是否是表已存在的错误，如果是则忽略
            if (err.message && err.message.includes('already exists')) {
              this.logger.info('数据库模式已存在，跳过初始化');
            } else {
              this.logger.error(err, '数据库模式初始化失败');
              // 不抛出错误，让应用继续运行
            }
          } finally {
            client.release();
          }
        } catch (err) {
          this.logger.error(err, '初始化数据库模式过程中发生错误');
          // 不抛出错误，让应用继续运行
        }
    }

    async getSignUrl(_path: string, _expires = 600): Promise<string> {
        // PostgreSQL不需要签名URL，返回空字符串
        return '';
    }

    /**
     * 检测对象是否存在
     */
    async hasObject(path: string): Promise<boolean> {
        try {
            const result = await this.pool.query(
                'SELECT 1 FROM objects WHERE path = $1',
                [this.getPath(path)]
            );
            return result.rowCount > 0;
        } catch (err) {
            this.logger.error(err, '检查对象是否存在失败: %s', path);
            return false;
        }
    }

    /**
     * 获取对象内容
     */
    async getObject(path: string, isCompressed = false): Promise<string | undefined> {
        try {
            const result = await this.pool.query(
                'SELECT content, is_compressed FROM objects WHERE path = $1',
                [this.getPath(path)]
            );
            
            if (result.rowCount === 0) {
                return undefined;
            }
            
            const content = result.rows[0].content;
            const isContentCompressed = result.rows[0].is_compressed;
            
            return toStr(content, isContentCompressed || isCompressed);
        } catch (err) {
            this.logger.error(err, '获取对象内容失败: %s', path);
            return undefined;
        }
    }

    /**
     * 获取对象元数据
     */
    async getObjectMeta(path: string): Promise<{ [key: string]: string } | undefined> {
        try {
            const result = await this.pool.query(
                'SELECT key, value FROM object_metadata WHERE path = $1',
                [this.getPath(path)]
            );
            
            if (result.rowCount === 0) {
                return undefined;
            }
            
            const meta: { [key: string]: string } = {};
            for (const row of result.rows) {
                meta[row.key] = row.value;
            }
            
            return meta;
        } catch (err) {
            this.logger.error(err, '获取对象元数据失败: %s', path);
            return undefined;
        }
    }

    /**
     * 获取对象和对象元数据
     */
    async getObjectAndMeta(
        path: string,
        isCompressed = false
    ): Promise<{
        content?: string;
        meta?: { [key: string]: string };
        contentType?: string;
        buffer?: Buffer;
    }> {
        try {
            const fullPath = this.getPath(path);
            
            // 获取对象内容和内容类型
            const contentResult = await this.pool.query(
                'SELECT content, content_type, is_compressed FROM objects WHERE path = $1',
                [fullPath]
            );
            
            if (contentResult.rowCount === 0) {
                return {};
            }
            
            const content = contentResult.rows[0].content;
            const contentType = contentResult.rows[0].content_type;
            const isContentCompressed = contentResult.rows[0].is_compressed;
            
            // 获取对象元数据
            const metaResult = await this.pool.query(
                'SELECT key, value FROM object_metadata WHERE path = $1',
                [fullPath]
            );
            
            const meta: { [key: string]: string } = {};
            for (const row of metaResult.rows) {
                meta[row.key] = row.value;
            }
            
            return {
                content: toStr(content, isContentCompressed || isCompressed),
                meta: metaResult.rowCount > 0 ? meta : undefined,
                contentType,
                buffer: content
            };
        } catch (err) {
            this.logger.error(err, '获取对象和元数据失败: %s', path);
            return {};
        }
    }

    /**
     * 存储对象
     */
    async putObject(
        path: string,
        raw: string | Buffer,
        options?: ObjectOptions,
        isCompressed?: boolean
    ): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            const fullPath = this.getPath(path);
            const content = Buffer.isBuffer(raw) ? raw : toBuffer(raw, isCompressed);
            
            // 插入或更新对象内容
            await client.query(
                `INSERT INTO objects (path, content, content_type, is_compressed)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (path) DO UPDATE
                 SET content = $2, content_type = $3, is_compressed = $4`,
                [fullPath, content, options?.contentType, !!isCompressed]
            );
            
            // 如果有元数据，则插入或更新元数据
            if (options?.meta && !isEmpty(options.meta)) {
                // 先删除现有元数据
                await client.query('DELETE FROM object_metadata WHERE path = $1', [fullPath]);
                
                // 插入新元数据
                for (const [key, value] of Object.entries(options.meta)) {
                    await client.query(
                        'INSERT INTO object_metadata (path, key, value) VALUES ($1, $2, $3)',
                        [fullPath, key, value]
                    );
                }
            }
            
            // 如果有头信息，则插入或更新头信息
            if (options?.headers) {
                // 先删除现有头信息
                await client.query('DELETE FROM object_headers WHERE path = $1', [fullPath]);
                
                // 插入新头信息
                if (options.headers.cacheControl) {
                    await client.query(
                        'INSERT INTO object_headers (path, header_type, value) VALUES ($1, $2, $3)',
                        [fullPath, 'cacheControl', options.headers.cacheControl]
                    );
                }
                
                if (options.headers.contentDisposition) {
                    await client.query(
                        'INSERT INTO object_headers (path, header_type, value) VALUES ($1, $2, $3)',
                        [fullPath, 'contentDisposition', options.headers.contentDisposition]
                    );
                }
                
                if (options.headers.contentEncoding) {
                    await client.query(
                        'INSERT INTO object_headers (path, header_type, value) VALUES ($1, $2, $3)',
                        [fullPath, 'contentEncoding', options.headers.contentEncoding]
                    );
                }
            }
            
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            this.logger.error(err, '存储对象失败: %s', path);
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * 删除对象
     */
    async deleteObject(path: string): Promise<void> {
        try {
            // 由于外键约束，删除objects表中的记录会自动删除相关的元数据和头信息
            await this.pool.query(
                'DELETE FROM objects WHERE path = $1',
                [this.getPath(path)]
            );
        } catch (err) {
            this.logger.error(err, '删除对象失败: %s', path);
            throw err;
        }
    }

    /**
     * 复制对象
     */
    async copyObject(fromPath: string, toPath: string, options: ObjectOptions): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            const fullFromPath = this.getPath(fromPath);
            const fullToPath = this.getPath(toPath);
            
            // 获取源对象
            const sourceResult = await client.query(
                'SELECT content, content_type, is_compressed FROM objects WHERE path = $1',
                [fullFromPath]
            );
            
            if (sourceResult.rowCount === 0) {
                throw new Error(`源对象不存在: ${fromPath}`);
            }
            
            const sourceContent = sourceResult.rows[0].content;
            const sourceContentType = options.contentType || sourceResult.rows[0].content_type;
            const sourceIsCompressed = sourceResult.rows[0].is_compressed;
            
            // 复制对象内容
            await client.query(
                `INSERT INTO objects (path, content, content_type, is_compressed)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (path) DO UPDATE
                 SET content = $2, content_type = $3, is_compressed = $4`,
                [fullToPath, sourceContent, sourceContentType, sourceIsCompressed]
            );
            
            // 处理元数据
            if (options.meta && !isEmpty(options.meta)) {
                // 使用新的元数据
                await client.query('DELETE FROM object_metadata WHERE path = $1', [fullToPath]);
                
                for (const [key, value] of Object.entries(options.meta)) {
                    await client.query(
                        'INSERT INTO object_metadata (path, key, value) VALUES ($1, $2, $3)',
                        [fullToPath, key, value]
                    );
                }
            } else {
                // 复制源对象的元数据
                const metaResult = await client.query(
                    'SELECT key, value FROM object_metadata WHERE path = $1',
                    [fullFromPath]
                );
                
                await client.query('DELETE FROM object_metadata WHERE path = $1', [fullToPath]);
                
                for (const row of metaResult.rows) {
                    await client.query(
                        'INSERT INTO object_metadata (path, key, value) VALUES ($1, $2, $3)',
                        [fullToPath, row.key, row.value]
                    );
                }
            }
            
            // 处理头信息
            if (options.headers) {
                await client.query('DELETE FROM object_headers WHERE path = $1', [fullToPath]);
                
                if (options.headers.cacheControl) {
                    await client.query(
                        'INSERT INTO object_headers (path, header_type, value) VALUES ($1, $2, $3)',
                        [fullToPath, 'cacheControl', options.headers.cacheControl]
                    );
                }
                
                if (options.headers.contentDisposition) {
                    await client.query(
                        'INSERT INTO object_headers (path, header_type, value) VALUES ($1, $2, $3)',
                        [fullToPath, 'contentDisposition', options.headers.contentDisposition]
                    );
                }
                
                if (options.headers.contentEncoding) {
                    await client.query(
                        'INSERT INTO object_headers (path, header_type, value) VALUES ($1, $2, $3)',
                        [fullToPath, 'contentEncoding', options.headers.contentEncoding]
                    );
                }
            } else {
                // 复制源对象的头信息
                const headersResult = await client.query(
                    'SELECT header_type, value FROM object_headers WHERE path = $1',
                    [fullFromPath]
                );
                
                await client.query('DELETE FROM object_headers WHERE path = $1', [fullToPath]);
                
                for (const row of headersResult.rows) {
                    await client.query(
                        'INSERT INTO object_headers (path, header_type, value) VALUES ($1, $2, $3)',
                        [fullToPath, row.header_type, row.value]
                    );
                }
            }
            
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            this.logger.error(err, '复制对象失败: %s -> %s', fromPath, toPath);
            throw err;
        } finally {
            client.release();
        }
    }
}
