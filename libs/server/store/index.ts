import { StorePostgreSQL } from './providers/postgresql';
import { StoreProvider } from './providers/base';
import { config } from 'libs/server/config';
import { PostgreSQLStoreConfiguration } from 'libs/server/config';

export function createStore(): StoreProvider {
    const cfg = config().store;
    
    // 直接使用PostgreSQL存储提供者，不再需要类型检查
    return new StorePostgreSQL({
        connectionString: cfg.connectionString,
        prefix: cfg.prefix,
    });
}

export { StoreProvider } from './providers/base';

