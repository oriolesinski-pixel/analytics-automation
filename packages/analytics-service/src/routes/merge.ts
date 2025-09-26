import { FastifyInstance } from 'fastify';
import { Octokit } from '@octokit/rest';

interface MergeBody {
    repoOwner: string;
    repoName: string;
    prNumber: number;
}

export default async function mergeRoutes(fastify: FastifyInstance) {
    fastify.post('/onboarding/merge', async (request, reply) => {
        try {
            const { repoOwner, repoName, prNumber } = request.body as MergeBody;

            // Get GitHub token from header
            const githubToken = request.headers['x-github-token'] as string;

            if (!githubToken) {
                return reply.status(401).send({ error: 'GitHub authentication required' });
            }

            const octokit = new Octokit({ auth: githubToken });

            // Check PR status first
            const { data: pr } = await octokit.pulls.get({
                owner: repoOwner,
                repo: repoName,
                pull_number: prNumber
            });

            // Check if already merged
            if (pr.merged) {
                return {
                    success: true,
                    message: 'Pull request is already merged',
                    mergedAt: pr.merged_at
                };
            }

            // Check if closed
            if (pr.state === 'closed') {
                return reply.status(400).send({
                    error: 'Pull request is closed and cannot be merged'
                });
            }

            // Check mergeability
            if (pr.mergeable === false) {
                return reply.status(409).send({
                    error: 'Pull request has conflicts and cannot be automatically merged'
                });
            }

            // If mergeable state is unknown, wait and re-check
            if (pr.mergeable === null) {
                await new Promise(resolve => setTimeout(resolve, 2000));

                const { data: prRecheck } = await octokit.pulls.get({
                    owner: repoOwner,
                    repo: repoName,
                    pull_number: prNumber
                });

                if (prRecheck.mergeable === false) {
                    return reply.status(409).send({
                        error: 'Pull request has conflicts and cannot be automatically merged'
                    });
                }
            }

            // Attempt to merge
            try {
                const { data: mergeResult } = await octokit.pulls.merge({
                    owner: repoOwner,
                    repo: repoName,
                    pull_number: prNumber,
                    commit_title: `Merge pull request #${prNumber}: Add Analytics Integration`,
                    commit_message: 'Automatically merged via Analytics Platform',
                    merge_method: 'merge'
                });

                // Optionally delete the branch after merge
                if (pr.head.ref) {
                    try {
                        await octokit.git.deleteRef({
                            owner: repoOwner,
                            repo: repoName,
                            ref: `heads/${pr.head.ref}`
                        });
                    } catch (e) {
                        // Branch deletion is optional, don't fail if it doesn't work
                        console.log('Could not delete branch:', e);
                    }
                }

                return {
                    success: true,
                    message: 'Pull request merged successfully',
                    sha: mergeResult.sha,
                    mergedAt: new Date().toISOString()
                };

            } catch (mergeError: any) {
                console.error('Merge failed:', mergeError);

                if (mergeError.status === 405) {
                    return reply.status(405).send({
                        error: 'Pull request cannot be merged. It may require reviews or status checks to pass.'
                    });
                }

                if (mergeError.status === 403) {
                    return reply.status(403).send({
                        error: 'You do not have permission to merge this pull request. Admin or write access required.'
                    });
                }

                return reply.status(mergeError.status || 500).send({
                    error: mergeError.message || 'Failed to merge pull request'
                });
            }

        } catch (error: any) {
            console.error('Error in merge endpoint:', error);
            return reply.status(500).send({
                error: error.message || 'Internal server error while merging PR'
            });
        }
    });
}