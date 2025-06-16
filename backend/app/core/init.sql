-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_progress table
CREATE TABLE IF NOT EXISTS user_progress (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id text NOT NULL,
    quiz_scores jsonb DEFAULT '{}',
    topics_covered jsonb DEFAULT '{}',
    last_activity timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);

-- Create document_chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
    id text PRIMARY KEY,
    document_id text,
    content text,
    embedding vector(1536),
    chunk_index integer,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id text NOT NULL,
    session_data jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- Create quiz_responses table
CREATE TABLE IF NOT EXISTS quiz_responses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id text NOT NULL,
    quiz_id text NOT NULL,
    responses jsonb DEFAULT '{}',
    score integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_responses_user_id ON quiz_responses(user_id);

-- Create chat_history table
CREATE TABLE IF NOT EXISTS chat_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id text NOT NULL,
    message text,
    role text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);

-- Create vector search indexes
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx ON document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS document_chunks_metadata_idx ON document_chunks 
USING gin (metadata);

CREATE INDEX IF NOT EXISTS document_chunks_doc_chunk_idx ON document_chunks (document_id, chunk_index); 