declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    connect(): Promise<PoolClient>;
    query(text: string, params?: any[]): Promise<QueryResult>;
    end(): Promise<void>;
  }

  export class Client {
    constructor(config?: any);
    connect(): Promise<void>;
    query(text: string, params?: any[]): Promise<QueryResult>;
    end(): Promise<void>;
  }

  export interface PoolClient {
    query(text: string, params?: any[]): Promise<QueryResult>;
    release(err?: Error): void;
  }

  export interface QueryResult {
    rows: any[];
    rowCount: number;
    command: string;
    oid: number;
    fields: FieldInfo[];
  }

  export interface FieldInfo {
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: string;
  }
}
