import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const state = crypto.randomBytes(16).toString('hex');
  
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_REDIRECT_URI!,
    state,
    scope: 'repo user read:org'
  });
  
  const response = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  );
  
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 10
  });
  
  return response;
}
