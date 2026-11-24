const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, optionalToken } = require('../middleware/auth');

// Helper to map category to UI details
const CATEGORY_MAP = {
  pothole: { label: 'Pothole', iconName: 'AlertCircle', color: '#d97706', bg: '#fef3c7' },
  water: { label: 'Waterlogging', iconName: 'Droplets', color: '#2563eb', bg: '#dbeafe' },
  roadwork: { label: 'Broken Road', iconName: 'Construction', color: '#ea580c', bg: '#ffedd5' },
  traffic: { label: 'Traffic Hazard', iconName: 'Car', color: '#dc2626', bg: '#fee2e2' },
  light: { label: 'Streetlight', iconName: 'Zap', color: '#ca8a04', bg: '#fef9c3' },
  garbage: { label: 'Garbage Dump', iconName: 'Trash2', color: '#16a34a', bg: '#dcfce7' },
  animal: { label: 'Stray Animal', iconName: 'Dog', color: '#9333ea', bg: '#f3e8ff' },
  other: { label: 'Civic Hazard', iconName: 'Activity', color: '#4b5563', bg: '#f3f4f6' },
};

// GET /api/issues
// Supports PostGIS viewport bounding box discovery: minLng, minLat, maxLng, maxLat, category, status, reporterId
router.get('/', optionalToken, async (req, res) => {
  try {
    const { minLng, minLat, maxLng, maxLat, category, status, reporterId } = req.query;
    const currentUserId = req.user ? req.user.id : null;

    let query = `
      SELECT 
        i.id,
        i.user_id AS "reporterId",
        u.name AS "reporterName",
        i.title,
        i.description,
        i.category,
        i.status,
        ST_X(i.location::geometry) AS lng,
        ST_Y(i.location::geometry) AS lat,
        i.address,
        i.photo_url AS "photoUrl",
        i.created_at AS "createdAt",
        i.updated_at AS "updatedAt",
        COUNT(c.id)::int AS confirmations,
        COALESCE(
          json_agg(c.user_id) FILTER (WHERE c.user_id IS NOT NULL),
          '[]'::json
        ) AS "confirmedBy"
      FROM issues i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN confirmations c ON i.id = c.issue_id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    // Viewport Bounding Box Filter via PostGIS ST_MakeEnvelope
    if (minLng && minLat && maxLng && maxLat) {
      const w = parseFloat(minLng);
      const s = parseFloat(minLat);
      const e = parseFloat(maxLng);
      const n = parseFloat(maxLat);

      if (!isNaN(w) && !isNaN(s) && !isNaN(e) && !isNaN(n)) {
        query += ` AND i.location && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)`;
        values.push(w, s, e, n);
        paramIndex += 4;
      }
    }

    // Reporter Filter
    if (reporterId) {
      const parsedReporterId = parseInt(reporterId, 10);
      if (!isNaN(parsedReporterId)) {
        query += ` AND i.user_id = $${paramIndex}`;
        values.push(parsedReporterId);
        paramIndex++;
      }
    }

    // Category Filter
    if (category && category !== 'all') {
      query += ` AND i.category = $${paramIndex}`;
      values.push(category);
      paramIndex++;
    }

    // Status Filter
    if (status && status !== 'all') {
      query += ` AND i.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    query += `
      GROUP BY i.id, u.name
      ORDER BY i.created_at DESC
      LIMIT 300
    `;

    const result = await db.query(query, values);

    // Format issues with UI decoration & ownership flags
    const issues = result.rows.map((row) => {
      const catConfig = CATEGORY_MAP[row.category] || CATEGORY_MAP.other;
      const isOwner = currentUserId !== null && row.reporterId === currentUserId;
      const hasConfirmed = currentUserId !== null && Array.isArray(row.confirmedBy) && row.confirmedBy.includes(currentUserId);

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        label: catConfig.label,
        iconName: catConfig.iconName,
        color: catConfig.color,
        bg: catConfig.bg,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        status: row.status,
        confirmations: row.confirmations,
        confirmedBy: row.confirmedBy,
        reporterId: row.reporterId,
        reporterName: row.reporterName,
        address: row.address,
        photoUrl: row.photoUrl,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        isOwner,
        hasConfirmed,
      };
    });

    res.json({
      count: issues.length,
      viewportDiscovered: Boolean(minLng && minLat),
      issues,
    });
  } catch (err) {
    console.error('Error fetching issues:', err);
    res.status(500).json({ error: 'Failed to retrieve issues from database.' });
  }
});

// GET /api/issues/my (My Reports flow)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT 
        i.id,
        i.user_id AS "reporterId",
        u.name AS "reporterName",
        i.title,
        i.description,
        i.category,
        i.status,
        ST_X(i.location::geometry) AS lng,
        ST_Y(i.location::geometry) AS lat,
        i.address,
        i.photo_url AS "photoUrl",
        i.created_at AS "createdAt",
        i.updated_at AS "updatedAt",
        COUNT(c.id)::int AS confirmations,
        COALESCE(
          json_agg(c.user_id) FILTER (WHERE c.user_id IS NOT NULL),
          '[]'::json
        ) AS "confirmedBy"
      FROM issues i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN confirmations c ON i.id = c.issue_id
      WHERE i.user_id = $1
      GROUP BY i.id, u.name
      ORDER BY i.created_at DESC
    `;

    const result = await db.query(query, [userId]);

    const issues = result.rows.map((row) => {
      const catConfig = CATEGORY_MAP[row.category] || CATEGORY_MAP.other;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        label: catConfig.label,
        iconName: catConfig.iconName,
        color: catConfig.color,
        bg: catConfig.bg,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        status: row.status,
        confirmations: row.confirmations,
        confirmedBy: row.confirmedBy,
        reporterId: row.reporterId,
        reporterName: row.reporterName,
        address: row.address,
        photoUrl: row.photoUrl,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        isOwner: true,
        hasConfirmed: Array.isArray(row.confirmedBy) && row.confirmedBy.includes(userId),
      };
    });

    res.json({
      reporterId: userId,
      total: issues.length,
      active: issues.filter((i) => i.status === 'Active').length,
      resolved: issues.filter((i) => i.status === 'Resolved').length,
      issues,
    });
  } catch (err) {
    console.error('Error in /api/issues/my:', err);
    res.status(500).json({ error: 'Failed to fetch personal reports.' });
  }
});

// POST /api/issues (Submit new issue)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, lat, lng, address, photoUrl } = req.body;
    const userId = req.user.id;

    if (!lat || !lng || !category) {
      return res.status(400).json({ error: 'Latitude, longitude, and category are required.' });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ error: 'Valid numerical coordinates are required.' });
    }

    // Strict Image Size Limit: Under 1MB enforced
    if (photoUrl && typeof photoUrl === 'string') {
      // Base64 string length check (1MB binary ~= 1.37MB in base64)
      const approxBytes = Math.ceil((photoUrl.length * 3) / 4);
      if (approxBytes > 1048576) {
        return res.status(400).json({ error: 'Image size exceeds 1MB limit. Please upload an optimized photo.' });
      }
    }

    const catConfig = CATEGORY_MAP[category] || CATEGORY_MAP.other;
    const finalTitle = title && title.trim() ? title.trim() : `${catConfig.label} reported`;
    const finalAddress = address || `Coordinates (${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)})`;

    // Insert into PostgreSQL with PostGIS ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    const insertQuery = `
      INSERT INTO issues (user_id, title, description, category, status, location, address, photo_url)
      VALUES ($1, $2, $3, $4, 'Active', ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8)
      RETURNING id, user_id AS "reporterId", title, description, category, status,
                ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat,
                address, photo_url AS "photoUrl", created_at AS "createdAt"
    `;

    const insertRes = await db.query(insertQuery, [
      userId,
      finalTitle,
      description || '',
      category,
      parsedLng,
      parsedLat,
      finalAddress,
      photoUrl || null,
    ]);

    const created = insertRes.rows[0];

    // Automatically register reporter's initial confirmation
    await db.query(
      'INSERT INTO confirmations (issue_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [created.id, userId]
    );

    res.status(201).json({
      id: created.id,
      title: created.title,
      description: created.description,
      category: created.category,
      label: catConfig.label,
      iconName: catConfig.iconName,
      color: catConfig.color,
      bg: catConfig.bg,
      lat: parseFloat(created.lat),
      lng: parseFloat(created.lng),
      status: created.status,
      confirmations: 1,
      confirmedBy: [userId],
      reporterId: userId,
      reporterName: req.user.name,
      address: created.address,
      photoUrl: created.photoUrl,
      createdAt: created.createdAt,
      isOwner: true,
      hasConfirmed: true,
    });
  } catch (err) {
    console.error('Error creating issue in DB:', err);
    res.status(500).json({ error: 'Failed to save report to database.' });
  }
});

// POST /api/issues/:id/confirm (Vouch / Confirm issue)
router.post('/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(issueId)) {
      return res.status(400).json({ error: 'Invalid issue ID.' });
    }

    // Verify issue exists
    const issueRes = await db.query('SELECT id FROM issues WHERE id = $1', [issueId]);
    if (issueRes.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    // Check if already confirmed
    const existing = await db.query(
      'SELECT id FROM confirmations WHERE issue_id = $1 AND user_id = $2',
      [issueId, userId]
    );

    let hasConfirmed = false;
    if (existing.rows.length > 0) {
      // Toggle off
      await db.query('DELETE FROM confirmations WHERE issue_id = $1 AND user_id = $2', [issueId, userId]);
      hasConfirmed = false;
    } else {
      // Toggle on
      await db.query('INSERT INTO confirmations (issue_id, user_id) VALUES ($1, $2)', [issueId, userId]);
      hasConfirmed = true;
    }

    // Get updated count and confirmedBy list
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS count, json_agg(user_id) AS "confirmedBy" 
       FROM confirmations WHERE issue_id = $1`,
      [issueId]
    );

    res.json({
      id: issueId,
      confirmations: countRes.rows[0].count || 0,
      confirmedBy: countRes.rows[0].confirmedBy || [],
      hasConfirmed,
    });
  } catch (err) {
    console.error('Error confirming issue:', err);
    res.status(500).json({ error: 'Failed to update confirmation.' });
  }
});

// PATCH /api/issues/:id/status (Toggle status: Active <-> Resolved)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { status } = req.body;

    if (isNaN(issueId)) {
      return res.status(400).json({ error: 'Invalid issue ID.' });
    }

    // Fetch issue and check ownership
    const issueRes = await db.query('SELECT id, user_id, status FROM issues WHERE id = $1', [issueId]);
    if (issueRes.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    const current = issueRes.rows[0];

    // Only creator can manually flip their report's status
    if (current.user_id !== userId && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only the reporter can change this issue status.' });
    }

    const nextStatus = status || (current.status === 'Resolved' ? 'Active' : 'Resolved');

    const updateRes = await db.query(
      `UPDATE issues SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [nextStatus, issueId]
    );

    res.json({
      id: issueId,
      status: updateRes.rows[0].status,
      updatedAt: updateRes.rows[0].updated_at,
    });
  } catch (err) {
    console.error('Error updating issue status:', err);
    res.status(500).json({ error: 'Failed to update issue status.' });
  }
});

// DELETE /api/issues/:id (Delete report - Owner only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const issueId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(issueId)) {
      return res.status(400).json({ error: 'Invalid issue ID.' });
    }

    // Fetch issue to verify ownership
    const issueRes = await db.query('SELECT id, user_id, title FROM issues WHERE id = $1', [issueId]);
    if (issueRes.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    if (issueRes.rows[0].user_id !== userId && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied: You can only delete issues reported through your own account.' });
    }

    await db.query('DELETE FROM issues WHERE id = $1', [issueId]);

    res.json({ message: 'Issue removed permanently from database.', id: issueId });
  } catch (err) {
    console.error('Error deleting issue:', err);
    res.status(500).json({ error: 'Failed to delete issue.' });
  }
});

module.exports = router;

