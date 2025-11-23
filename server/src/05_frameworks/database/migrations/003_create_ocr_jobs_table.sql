-- OCR Jobs Table for async processing
-- This table tracks the status of OCR job submissions

CREATE TABLE IF NOT EXISTS ocr_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  
  -- Input data
  file_paths TEXT[], -- Array of file paths that were uploaded
  ocr_text TEXT, -- Combined OCR text result
  
  -- Output data
  result JSONB, -- Cleaned recipe result from clean-recipe-service
  error TEXT, -- Error message if failed
  
  -- Metadata
  processing_time_ms INTEGER, -- How long the job took to process
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT ocr_jobs_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_job_id ON ocr_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_user_id ON ocr_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status ON ocr_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_created_at ON ocr_jobs(created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_ocr_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ocr_jobs_updated_at
  BEFORE UPDATE ON ocr_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_ocr_jobs_updated_at();
