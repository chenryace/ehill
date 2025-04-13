import { StoreS3 } from './providers/s3';
import { StorePostgreSQL } from './providers/postgresql';
import { StoreProvider } from './providers/base';
import { config } from 'libs/server/config';
import { PostgreSQLStoreConfiguration, S3StoreConfiguration, StoreConfiguration } from 'libs/server/config';

export function createStore(): StoreProvider {
    const cfg = config().store;
    
    // 使用类型守卫来确保TypeScript能正确识别类型
    function isPostgreSQLConfig(config: StoreConfiguration): config is PostgreSQLStoreConfiguration {
        return config.type === 'postgresql';
    }
    
    function isS3Config(config: StoreConfiguration): config is S3StoreConfiguration {
        return config.type === 's3';
    }
    
    // 根据配置类型选择存储提供者
    if (isPostgreSQLConfig(cfg)) {
        return new StorePostgreSQL({
            connectionString: cfg.connectionString,
            prefix: cfg.prefix,
        });
    } else if (isS3Config(cfg)) {
        // 使用S3存储
        return new StoreS3({
            accessKey: cfg.accessKey,
            secretKey: cfg.secretKey,
            endPoint: cfg.endpoint,
            bucket: cfg.bucket,
            region: cfg.region,
            pathStyle: cfg.forcePathStyle,
            prefix: cfg.prefix,
        });
    } else {
        // 默认使用S3存储（兜底方案）
        const s3Config = cfg as S3StoreConfiguration;
        return new StoreS3({
            accessKey: s3Config.accessKey,
            secretKey: s3Config.secretKey,
            endPoint: s3Config.endpoint,
            bucket: s3Config.bucket,
            region: s3Config.region,
            pathStyle: s3Config.forcePathStyle,
            prefix: s3Config.prefix,
        });
    }
}

export { StoreProvider } from './providers/base';
