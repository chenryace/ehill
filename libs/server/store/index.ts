import { StoreS3 } from './providers/s3';
import { StorePostgreSQL } from './providers/postgresql';
import { StoreProvider } from './providers/base';
import { config } from 'libs/server/config';

export function createStore(): StoreProvider {
    const cfg = config().store;
    
    // 根据配置类型选择存储提供者
    if (cfg.type === 'postgresql') {
        return new StorePostgreSQL({
            connectionString: cfg.connectionString,
            prefix: cfg.prefix,
        });
    } else {
        // 默认使用S3存储
        return new StoreS3({
            accessKey: cfg.accessKey,
            secretKey: cfg.secretKey,
            endPoint: cfg.endpoint,
            bucket: cfg.bucket,
            region: cfg.region,
            pathStyle: cfg.forcePathStyle,
            prefix: cfg.prefix,
        });
    }
}

export { StoreProvider } from './providers/base';
