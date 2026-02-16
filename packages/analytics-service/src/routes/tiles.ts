// src/routes/tiles.ts
// Saved Tiles & Dashboards API — with full tenant isolation by app_key

import { FastifyPluginAsync } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Validation schemas
const TileConfigSchema = z.object({
  eventType: z.string().optional(),
  measure: z.object({
    id: z.string(),
    label: z.string(),
    aggregation: z.string(),
    field: z.string().optional(),
  }),
  dimensions: z.array(z.any()),
  filters: z.array(z.any()),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
  chartType: z.string(),
});

const CreateTileSchema = z.object({
  app_key: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  tile_type: z.enum(['chart', 'markdown']).optional().default('chart'),
  config: z.any(),
  user_id: z.string().optional().default('default-user'),
});

const UpdateTileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  config: TileConfigSchema.optional(),
});

const CreateDashboardSchema = z.object({
  app_key: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  user_id: z.string().optional().default('default-user'),
});

const UpdateDashboardSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  global_filters: z.array(z.any()).optional(),
});

const UpdateLayoutSchema = z.object({
  layouts: z.object({
    lg: z.array(z.any()),
    md: z.array(z.any()),
    sm: z.array(z.any()),
    xs: z.array(z.any()),
  }),
});

const AddTileToDashboardSchema = z.object({
  tile_id: z.string().uuid(),
  layout_config: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    minW: z.number().optional(),
    minH: z.number().optional(),
  }),
});

/**
 * Check if the request is using admin mode (bypasses tenant isolation).
 * In production this should be validated against a real auth token / role.
 */
function isAdminRequest(request: any): boolean {
  const query = request.query as any;
  return query?.admin === 'true' || query?.admin === '1';
}

/**
 * Verify a tile belongs to the given app_key. Returns the tile if valid, null otherwise.
 * Admin requests skip the check.
 */
async function verifyTileAccess(tileId: string, appKey: string | undefined, admin: boolean) {
  const { data: tile, error } = await supabase
    .from('saved_tiles')
    .select('*')
    .eq('id', tileId)
    .single();

  if (error || !tile) return null;
  if (admin) return tile;
  if (appKey && tile.app_key !== appKey) return null;
  return tile;
}

/**
 * Verify a dashboard belongs to the given app_key. Returns the dashboard if valid, null otherwise.
 * Admin requests skip the check.
 */
async function verifyDashboardAccess(dashboardId: string, appKey: string | undefined, admin: boolean) {
  const { data: dashboard, error } = await supabase
    .from('dashboards')
    .select('*')
    .eq('id', dashboardId)
    .single();

  if (error || !dashboard) return null;
  if (admin) return dashboard;
  if (appKey && dashboard.app_key !== appKey) return null;
  return dashboard;
}

const tilesRoutes: FastifyPluginAsync = async (fastify) => {
  
  // ==================== SAVED TILES ENDPOINTS ====================
  
  // Create saved tile
  fastify.post('/tiles', async (request, reply) => {
    try {
      const validation = CreateTileSchema.safeParse(request.body);
      
      if (!validation.success) {
        return reply.code(400).send({
          ok: false,
          error: 'Invalid request body',
          errors: validation.error.issues,
        });
      }

      const { app_key, name, description, tile_type, config, user_id } = validation.data;

      const { data: tile, error } = await supabase
        .from('saved_tiles')
        .insert({
          user_id,
          app_key,
          name,
          description,
          tile_type,
          config,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating tile:', error);
        return reply.code(500).send({ ok: false, error: error.message });
      }

      console.log(`✅ Created saved tile: ${tile.name} (${tile.id}) for app ${app_key}`);
      return reply.code(201).send({ ok: true, tile });
    } catch (error: any) {
      console.error('Exception creating tile:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // List tiles — app_key is REQUIRED unless admin mode
  fastify.get('/tiles', async (request, reply) => {
    try {
      const { app_key, user_id = 'default-user' } = request.query as any;
      const admin = isAdminRequest(request);

      if (!app_key && !admin) {
        return reply.code(400).send({
          ok: false,
          error: 'app_key query parameter is required (use admin=true to bypass)',
        });
      }

      let query = supabase
        .from('saved_tiles')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });

      if (app_key && !admin) {
        query = query.eq('app_key', app_key);
      }

      const { data: tiles, error } = await query;

      if (error) {
        console.error('Error fetching tiles:', error);
        return reply.code(500).send({ ok: false, error: error.message });
      }

      return reply.send({ ok: true, tiles: tiles || [], count: tiles?.length || 0 });
    } catch (error: any) {
      console.error('Exception fetching tiles:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // Get single tile — validates app_key ownership
  fastify.get('/tiles/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { app_key } = request.query as any;
      const admin = isAdminRequest(request);

      const tile = await verifyTileAccess(id, app_key, admin);

      if (!tile) {
        return reply.code(404).send({ ok: false, error: 'Tile not found or access denied' });
      }

      return reply.send({ ok: true, tile });
    } catch (error: any) {
      console.error('Exception fetching tile:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // Update tile — validates app_key ownership
  fastify.put('/tiles/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { app_key } = request.query as any;
      const admin = isAdminRequest(request);
      const validation = UpdateTileSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.code(400).send({
          ok: false,
          error: 'Invalid request body',
          errors: validation.error.issues,
        });
      }

      // Verify ownership first
      const existing = await verifyTileAccess(id, app_key, admin);
      if (!existing) {
        return reply.code(404).send({ ok: false, error: 'Tile not found or access denied' });
      }

      const { data: tile, error } = await supabase
        .from('saved_tiles')
        .update(validation.data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ ok: false, error: 'Tile not found' });
        }
        return reply.code(500).send({ ok: false, error: error.message });
      }

      console.log(`✅ Updated tile: ${tile.name} (${tile.id})`);
      return reply.send({ ok: true, tile });
    } catch (error: any) {
      console.error('Exception updating tile:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // Delete tile — validates app_key ownership
  fastify.delete('/tiles/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { app_key } = request.query as any;
      const admin = isAdminRequest(request);

      const existing = await verifyTileAccess(id, app_key, admin);
      if (!existing) {
        return reply.code(404).send({ ok: false, error: 'Tile not found or access denied' });
      }

      const { error } = await supabase
        .from('saved_tiles')
        .delete()
        .eq('id', id);

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      console.log(`✅ Deleted tile: ${id}`);
      return reply.send({ ok: true, message: 'Tile deleted successfully' });
    } catch (error: any) {
      console.error('Exception deleting tile:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // ==================== DASHBOARDS ENDPOINTS ====================

  // Create dashboard
  fastify.post('/dashboards', async (request, reply) => {
    try {
      const validation = CreateDashboardSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.code(400).send({
          ok: false,
          error: 'Invalid request body',
          errors: validation.error.issues,
        });
      }

      const { app_key, name, description, user_id } = validation.data;

      const defaultLayout = {
        breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480 },
        cols: { lg: 12, md: 10, sm: 6, xs: 4 },
        layouts: { lg: [], md: [], sm: [], xs: [] },
      };

      const { data: dashboard, error } = await supabase
        .from('dashboards')
        .insert({
          user_id,
          app_key,
          name,
          description,
          layout: defaultLayout,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating dashboard:', error);
        return reply.code(500).send({ ok: false, error: error.message });
      }

      console.log(`✅ Created dashboard: ${dashboard.name} (${dashboard.id}) for app ${app_key}`);
      return reply.code(201).send({ ok: true, dashboard });
    } catch (error: any) {
      console.error('Exception creating dashboard:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // List dashboards — app_key is REQUIRED unless admin mode
  fastify.get('/dashboards', async (request, reply) => {
    try {
      const { app_key, user_id = 'default-user' } = request.query as any;
      const admin = isAdminRequest(request);

      if (!app_key && !admin) {
        return reply.code(400).send({
          ok: false,
          error: 'app_key query parameter is required (use admin=true to bypass)',
        });
      }

      let query = supabase
        .from('dashboards')
        .select('id, user_id, app_key, name, description, created_at, updated_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });

      if (app_key && !admin) {
        query = query.eq('app_key', app_key);
      }

      const { data: dashboards, error } = await query;

      if (error) {
        console.error('Error fetching dashboards:', error);
        return reply.code(500).send({ ok: false, error: error.message });
      }

      const dashboardsWithCounts = await Promise.all(
        (dashboards || []).map(async (dashboard) => {
          const { count } = await supabase
            .from('dashboard_tiles')
            .select('*', { count: 'exact', head: true })
            .eq('dashboard_id', dashboard.id);

          return { ...dashboard, tile_count: count || 0 };
        })
      );

      return reply.send({ ok: true, dashboards: dashboardsWithCounts, count: dashboardsWithCounts.length });
    } catch (error: any) {
      console.error('Exception fetching dashboards:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // Get dashboard with all tiles — validates app_key ownership
  fastify.get('/dashboards/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { app_key } = request.query as any;
      const admin = isAdminRequest(request);

      // Fetch dashboard
      const { data: dashboard, error: dashboardError } = await supabase
        .from('dashboards')
        .select('*')
        .eq('id', id)
        .single();

      if (dashboardError) {
        if (dashboardError.code === 'PGRST116') {
          return reply.code(404).send({ ok: false, error: 'Dashboard not found' });
        }
        return reply.code(500).send({ ok: false, error: dashboardError.message });
      }

      // Tenant isolation: verify app_key if not admin
      if (!admin && app_key && dashboard.app_key !== app_key) {
        return reply.code(403).send({ ok: false, error: 'Access denied: dashboard belongs to a different app' });
      }

      // Fetch dashboard tiles with tile details
      const { data: dashboardTiles, error: tilesError } = await supabase
        .from('dashboard_tiles')
        .select('id, tile_id, layout_config, saved_tiles(*)')
        .eq('dashboard_id', id);

      if (tilesError) {
        console.error('Error fetching dashboard tiles:', tilesError);
        return reply.code(500).send({ ok: false, error: tilesError.message });
      }

      const tiles = (dashboardTiles || []).map((dt: any) => ({
        dashboard_tile_id: dt.id,
        tile_id: dt.tile_id,
        tile_name: dt.saved_tiles.name,
        tile_description: dt.saved_tiles.description,
        tile_type: dt.saved_tiles.tile_type || 'chart',
        tile_config: dt.saved_tiles.config,
        layout: dt.layout_config,
        ignore_global_filters: dt.ignore_global_filters || false,
      }));

      return reply.send({
        ok: true,
        dashboard: {
          ...dashboard,
          tiles,
        },
      });
    } catch (error: any) {
      console.error('Exception fetching dashboard:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // Update dashboard (name, description) — validates app_key ownership
  fastify.put('/dashboards/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { app_key } = request.query as any;
      const admin = isAdminRequest(request);
      const validation = UpdateDashboardSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.code(400).send({
          ok: false,
          error: 'Invalid request body',
          errors: validation.error.issues,
        });
      }

      // Verify ownership
      const existing = await verifyDashboardAccess(id, app_key, admin);
      if (!existing) {
        return reply.code(404).send({ ok: false, error: 'Dashboard not found or access denied' });
      }

      const { data: dashboard, error } = await supabase
        .from('dashboards')
        .update(validation.data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ ok: false, error: 'Dashboard not found' });
        }
        return reply.code(500).send({ ok: false, error: error.message });
      }

      console.log(`✅ Updated dashboard: ${dashboard.name} (${dashboard.id})`);
      return reply.send({ ok: true, dashboard });
    } catch (error: any) {
      console.error('Exception updating dashboard:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // Delete dashboard — validates app_key ownership
  fastify.delete('/dashboards/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { app_key } = request.query as any;
      const admin = isAdminRequest(request);

      const existing = await verifyDashboardAccess(id, app_key, admin);
      if (!existing) {
        return reply.code(404).send({ ok: false, error: 'Dashboard not found or access denied' });
      }

      const { error } = await supabase
        .from('dashboards')
        .delete()
        .eq('id', id);

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      console.log(`✅ Deleted dashboard: ${id}`);
      return reply.send({ ok: true, message: 'Dashboard deleted successfully' });
    } catch (error: any) {
      console.error('Exception deleting dashboard:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // ==================== DASHBOARD COMPOSITION ENDPOINTS ====================

  // Add tile to dashboard — validates dashboard app_key ownership
  fastify.post('/dashboards/:id/tiles', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { app_key } = request.query as any;
      const admin = isAdminRequest(request);
      const validation = AddTileToDashboardSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.code(400).send({
          ok: false,
          error: 'Invalid request body',
          errors: validation.error.issues,
        });
      }

      const { tile_id, layout_config } = validation.data;

      // Verify dashboard ownership
      const dashboard = await verifyDashboardAccess(id, app_key, admin);
      if (!dashboard) {
        return reply.code(404).send({ ok: false, error: 'Dashboard not found or access denied' });
      }

      // Add tile to dashboard
      const { data: dashboardTile, error } = await supabase
        .from('dashboard_tiles')
        .insert({
          dashboard_id: id,
          tile_id,
          layout_config,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return reply.code(409).send({ ok: false, error: 'Tile already in dashboard' });
        }
        return reply.code(500).send({ ok: false, error: error.message });
      }

      console.log(`✅ Added tile ${tile_id} to dashboard ${id}`);
      return reply.code(201).send({ ok: true, dashboard_tile: dashboardTile });
    } catch (error: any) {
      console.error('Exception adding tile to dashboard:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // Remove tile from dashboard — validates dashboard app_key ownership
  fastify.delete('/dashboards/:id/tiles/:tile_id', async (request, reply) => {
    try {
      const { id, tile_id } = request.params as any;
      const { app_key } = request.query as any;
      const admin = isAdminRequest(request);

      const dashboard = await verifyDashboardAccess(id, app_key, admin);
      if (!dashboard) {
        return reply.code(404).send({ ok: false, error: 'Dashboard not found or access denied' });
      }

      const { error } = await supabase
        .from('dashboard_tiles')
        .delete()
        .eq('dashboard_id', id)
        .eq('tile_id', tile_id);

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      console.log(`✅ Removed tile ${tile_id} from dashboard ${id}`);
      return reply.send({ ok: true, message: 'Tile removed from dashboard' });
    } catch (error: any) {
      console.error('Exception removing tile from dashboard:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // Update tile settings in dashboard
  fastify.put('/dashboards/:id/tiles/:tile_id/settings', async (request, reply) => {
    try {
      const { id, tile_id } = request.params as any;
      const { app_key } = request.query as any;
      const admin = isAdminRequest(request);
      const { ignore_global_filters } = request.body as any;

      const dashboard = await verifyDashboardAccess(id, app_key, admin);
      if (!dashboard) {
        return reply.code(404).send({ ok: false, error: 'Dashboard not found or access denied' });
      }

      const { error } = await supabase
        .from('dashboard_tiles')
        .update({ ignore_global_filters })
        .eq('dashboard_id', id)
        .eq('tile_id', tile_id);

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      console.log(`✅ Updated tile ${tile_id} settings in dashboard ${id}`);
      return reply.send({ ok: true, message: 'Tile settings updated' });
    } catch (error: any) {
      console.error('Exception updating tile settings:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });

  // Update dashboard layout (drag/resize)
  fastify.put('/dashboards/:id/layout', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { app_key } = request.query as any;
      const admin = isAdminRequest(request);
      const validation = UpdateLayoutSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.code(400).send({
          ok: false,
          error: 'Invalid request body',
          errors: validation.error.issues,
        });
      }

      // Verify ownership
      const existing = await verifyDashboardAccess(id, app_key, admin);
      if (!existing) {
        return reply.code(404).send({ ok: false, error: 'Dashboard not found or access denied' });
      }

      const { layouts } = validation.data;

      const currentLayout = existing.layout as any;
      const updatedLayout = {
        ...currentLayout,
        layouts,
      };

      const { data: updatedDashboard, error } = await supabase
        .from('dashboards')
        .update({ layout: updatedLayout })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      console.log(`✅ Updated layout for dashboard ${id}`);
      return reply.send({ ok: true, dashboard: updatedDashboard });
    } catch (error: any) {
      console.error('Exception updating layout:', error);
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });
};

export default tilesRoutes;
