import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.redirect('http://localhost:3002/onboarding?error=no_code');
  }
  
  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    });
    
    const { access_token } = await tokenResponse.json();
    
    // Get user info
    const octokit = new Octokit({ auth: access_token });
    const { data: user } = await octokit.users.getAuthenticated();
    
    // Set cookies and redirect
    const response = NextResponse.redirect('http://localhost:3002/onboarding/repos');
    response.cookies.set('github_token', access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });
    response.cookies.set('github_user', JSON.stringify({
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url
    }), {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });
    
    return response;
  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect('http://localhost:3002/onboarding?error=oauth_failed');
  }
}
