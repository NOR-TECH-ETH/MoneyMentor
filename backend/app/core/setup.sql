-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_progress table with all required columns
CREATE TABLE IF NOT EXISTS user_progress (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id text NOT NULL,
    quiz_scores jsonb DEFAULT '{}',
    topics_covered jsonb DEFAULT '{}',
    last_activity timestamp with time zone DEFAULT now(),
    last_quiz_type text,
    last_quiz_score numeric,
    last_quiz_date timestamp with time zone,
    strengths jsonb DEFAULT '[]',
    weaknesses jsonb DEFAULT '[]',
    recommendations jsonb DEFAULT '[]',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);

-- Create dedicated quiz_responses table for Google Sheets integration
CREATE TABLE IF NOT EXISTS quiz_responses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id text NOT NULL,
    timestamp timestamp with time zone DEFAULT now(),
    quiz_id text NOT NULL,
    topic text,
    selected text,
    correct boolean,
    quiz_type text DEFAULT 'micro',
    score numeric,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_responses_user_id ON quiz_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_timestamp ON quiz_responses(timestamp);

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

-- Create chat_history table
CREATE TABLE IF NOT EXISTS chat_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id text NOT NULL,
    message text,
    role text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);