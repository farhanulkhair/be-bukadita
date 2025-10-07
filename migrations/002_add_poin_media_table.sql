-- Migration untuk table poin_media_materis
-- Jalankan di Supabase SQL Editor

-- -------------------------
-- Table: poin_media_materis
-- -------------------------
CREATE TABLE IF NOT EXISTS public.poin_media_materis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poin_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('image', 'video', 'audio', 'pdf', 'other')),
  url text NOT NULL,
  caption text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_poin_media_poin_id FOREIGN KEY (poin_id) REFERENCES public.poin_details (id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_poin_media_poin_id ON public.poin_media_materis (poin_id);
CREATE INDEX IF NOT EXISTS idx_poin_media_order ON public.poin_media_materis (poin_id, order_index);

-- RLS Policies
ALTER TABLE public.poin_media_materis ENABLE ROW LEVEL SECURITY;

-- Policy: Admin dapat CRUD semua
CREATE POLICY "Admin can manage all media" ON public.poin_media_materis
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      JOIN public.roles r ON ur.role_id = r.id 
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('admin', 'superadmin')
    )
  );

-- Policy: User dapat read media dari sub_materi yang published
CREATE POLICY "Users can view published media" ON public.poin_media_materis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.poin_details pd
      JOIN public.sub_materis sm ON pd.sub_materi_id = sm.id
      WHERE pd.id = poin_id 
      AND sm.published = true
    )
  );