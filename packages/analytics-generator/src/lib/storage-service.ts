import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class StorageService {
  private bucketName = 'generated-analytics';

  async initialize() {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(b => b.name === this.bucketName)) {
      await supabase.storage.createBucket(this.bucketName, {
        public: false
      });
    }
  }

  async saveOutput(repoId: string, type: string, content: any) {
    const path = `${repoId}/${type}/${Date.now()}.json`;
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(path, JSON.stringify(content, null, 2));
    
    if (error) throw error;
    
    // Save metadata to database
    await supabase.from('generated_outputs').insert({
      repo_id: repoId,
      output_type: type,
      file_path: path,
      created_at: new Date().toISOString()
    });
    
    // Optional: Keep local copy for dev
    if (process.env.KEEP_LOCAL_COPY === 'true') {
      const fs = await import('fs/promises');
      const localPath = `./src/utils/generated-outputs/unified/${repoId}/${type}.json`;
      await fs.mkdir(localPath.substring(0, localPath.lastIndexOf('/')), { recursive: true });
      await fs.writeFile(localPath, JSON.stringify(content, null, 2));
    }
    
    return { path, url: await this.getSignedUrl(path) };
  }

  async getLatest(repoId: string, type: string) {
    const { data } = await supabase
      .from('generated_outputs')
      .select('*')
      .eq('repo_id', repoId)
      .eq('output_type', type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!data) return null;
    
    const { data: file } = await supabase.storage
      .from(this.bucketName)
      .download(data.file_path);
    
    return file ? await file.text() : null;
  }

  private async getSignedUrl(path: string) {
    const { data } = await supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, 3600);
    return data?.signedUrl;
  }
}

export const storageService = new StorageService();
