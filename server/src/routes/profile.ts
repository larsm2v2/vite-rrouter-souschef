import express, { Request, Response } from 'express';
import pool from '../config/database';

const router = express.Router();

/**
 * POST /profile/reset-stats
 * Reset current_level to 1, clear best_combination and saved_maps for the logged-in user
 */
router.post('/reset-stats', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = (req.user as any).id;
  try {
    await pool.query(
      `UPDATE game_stats
         SET current_level      = 1,
             best_combination   = '[]'::jsonb
       WHERE user_id = $1`,
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error resetting game stats:', err);
    res.status(500).json({ error: 'Failed to reset game stats' });
  }
});

/**
 * DELETE /profile/saved-maps/:level
 * Delete a custom saved puzzle pattern for the logged-in user
 */
router.delete('/saved-maps/:level', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const level = parseInt(req.params.level, 10);
  if (isNaN(level)) {
    return res.status(400).json({ error: 'Invalid level parameter' });
  }

  try {
    const userId = (req.user as any).id;
    // Remove the saved map entry for the specified level
    const { rows } = await pool.query(
      `UPDATE game_stats
         SET saved_maps = (
           SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
           FROM jsonb_array_elements(saved_maps) AS item
           WHERE (item->>'level')::int != $1
         )
       WHERE user_id = $2
       RETURNING saved_maps`,
      [level, userId]
    );
    const updatedMaps: any[] = rows[0]?.saved_maps || [];
    res.json({ success: true, saved_maps: updatedMaps });
  } catch (err) {
    console.error('Error deleting saved map:', err);
    res.status(500).json({ error: 'Failed to delete saved map' });
  }
});

export default router;
