// src/routes/apps-register.ts
import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';

export async function registerAppsRoute(fastify: FastifyInstance) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  fastify.post('/apps/register', async (request, reply) => {
    try {
      const { app_key, name, domain } = request.body as any;

      if (!app_key || !name) {
        return reply.status(400).send({
          ok: false,
          error: 'app_key and name are required'
        });
      }

      // Check if app already exists
      const { data: existingApp } = await supabase
        .from('apps')
        .select('*')
        .eq('app_key', app_key)
        .single();

      if (existingApp) {
        return reply.send({
          ok: true,
          message: 'App already exists',
          app: existingApp
        });
      }

      // Create new app
      const { data: newApp, error } = await supabase
        .from('apps')
        .insert({
          app_key,
          name,
          domain: domain || 'localhost:3000',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to register app:', error);
        return reply.status(500).send({
          ok: false,
          error: error.message
        });
      }

      console.log(`✅ Registered new app: ${app_key}`);
      
      return reply.send({
        ok: true,
        message: 'App registered successfully',
        app: newApp
      });
    } catch (error) {
      console.error('Error in app registration:', error);
      return reply.status(500).send({
        ok: false,
        error: 'Internal server error'
      });
    }
  });
}
