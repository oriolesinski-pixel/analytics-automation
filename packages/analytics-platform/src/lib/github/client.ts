import { Octokit } from '@octokit/rest';

export class GitHubClient {
  private octokit: Octokit | null = null;
  
  constructor(token?: string) {
    if (token) {
      this.octokit = new Octokit({ auth: token });
    }
  }
  
  async listRepositories() {
    if (!this.octokit) throw new Error('Not authenticated');
    
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
      type: 'owner'
    });
    
    return data;
  }
  
  async getRepository(owner: string, repo: string) {
    if (!this.octokit) throw new Error('Not authenticated');
    
    const { data } = await this.octokit.repos.get({ owner, repo });
    return data;
  }
}
