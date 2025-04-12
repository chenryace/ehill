-- PostgreSQL schema for Notea

-- 存储对象内容和元数据的表
CREATE TABLE IF NOT EXISTS objects (
    -- 对象路径作为主键
    path TEXT PRIMARY KEY,
    -- 对象内容
    content BYTEA,
    -- 内容类型
    content_type TEXT,
    -- 是否压缩
    is_compressed BOOLEAN DEFAULT FALSE,
    -- 创建时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- 更新时间
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 存储对象元数据的表
CREATE TABLE IF NOT EXISTS object_metadata (
    -- 对象路径作为外键
    path TEXT REFERENCES objects(path) ON DELETE CASCADE,
    -- 元数据键
    key TEXT NOT NULL,
    -- 元数据值
    value TEXT,
    -- 主键约束
    PRIMARY KEY (path, key)
);

-- 存储对象头信息的表
CREATE TABLE IF NOT EXISTS object_headers (
    -- 对象路径作为外键
    path TEXT REFERENCES objects(path) ON DELETE CASCADE,
    -- 头信息类型 (cacheControl, contentDisposition, contentEncoding)
    header_type TEXT NOT NULL,
    -- 头信息值
    value TEXT,
    -- 主键约束
    PRIMARY KEY (path, header_type)
);

-- 更新对象时间的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为objects表创建更新时间触发器
CREATE TRIGGER update_objects_updated_at
BEFORE UPDATE ON objects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_object_metadata_key ON object_metadata(key);
CREATE INDEX IF NOT EXISTS idx_object_headers_type ON object_headers(header_type);
