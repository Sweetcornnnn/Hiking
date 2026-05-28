from pathlib import Path
import re

path = Path('saka.ts')
text = path.read_text(encoding='utf-8')

# Insert discovery routes before stats
stats_anchor = re.search(r"app\.get\('/api/wildtrack/stats'", text)
if not stats_anchor:
    raise SystemExit('stats anchor not found')

new_routes = '''app.get('/api/wildtrack/discoveries', authenticateToken, (req: any, res: any) => {
  const { mountain_id, category } = req.query;

  let query = `
    SELECT d.*, s.scientific_name, s.common_name, s.category, s.image_url, s.conservation_status
    FROM discoveries d
    JOIN species s ON d.species_id = s.id
    WHERE d.user_id = ?
  `;
  const params: any[] = [req.user.id];

  if (mountain_id) {
    query += ' AND d.mountain_id = ?';
    params.push(mountain_id);
  }

  if (category) {
    query += ' AND s.category = ?';
    params.push(category);
  }

  query += ' ORDER BY d.discovered_at DESC';

  db.all(query, params, (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('Error fetching discoveries:', err.message);
      return res.status(500).json({ error: 'Failed to fetch discoveries' });
    }
    res.json({ discoveries: rows });
  });
});

app.post('/api/wildtrack/discover', authenticateToken, (req: any, res: any) => {
  const { species_id, mountain_id, latitude, longitude, notes } = req.body;

  if (!species_id || !mountain_id) {
    return res.status(400).json({ error: 'species_id and mountain_id are required' });
  }

  db.get(
    'SELECT id FROM discoveries WHERE user_id = ? AND species_id = ? AND mountain_id = ?',
    [req.user.id, species_id, mountain_id],
    (err: Error | null, existing: any) => {
      if (err) {
        console.error('Error checking existing discovery:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }

      if (existing) {
        return res.status(400).json({ error: 'Species already discovered on this mountain' });
      }

      db.run(
        'INSERT INTO discoveries (user_id, species_id, mountain_id, latitude, longitude, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.id, species_id, mountain_id, latitude or None, longitude or None, notes or None],
        function(this: any, err: Error | null) {
          if (err) {
            console.error('Error creating discovery:', err.message);
            return res.status(500).json({ error: 'Failed to create discovery' });
          }

          res.status(201).json({
            message: 'Discovery recorded',
            discovery_id: this.lastID,
          });
        }
      );
    }
  );
});

app.delete('/api/wildtrack/discovery/:id', authenticateToken, (req: any, res: any) => {
  const { id } = req.params;

  db.get(
    'SELECT * FROM discoveries WHERE id = ? AND user_id = ?',
    [id, req.user.id],
    (err: Error | null, discovery: any) => {
      if (err) {
        console.error('Error checking discovery:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!discovery) {
        return res.status(404).json({ error: 'Discovery not found' });
      }

      db.run(
        'DELETE FROM discoveries WHERE id = ? AND user_id = ?',
        [id, req.user.id],
        function(this: any, err: Error | null) {
          if (err) {
            console.error('Error deleting discovery:', err.message);
            return res.status(500).json({ error: 'Failed to delete discovery' });
          }

          res.json({ message: 'Discovery removed successfully' });
        }
      );
    }
  );
});
'''

text = text[:stats_anchor.start()] + new_routes + "\n\n" + text[stats_anchor.start():]

stats_pattern = re.compile(r"app\.get\('/api/wildtrack/stats', \(req: any, res: any\) => \{[\s\S]*?\n\}\);", re.MULTILINE)
replacement = '''app.get('/api/wildtrack/stats', authenticateToken, (req: any, res: any) => {
  const { mountain_id } = req.query;

  let countQuery = 'SELECT COUNT(*) as discovered_count FROM discoveries WHERE user_id = ?';
  const countParams: any[] = [req.user.id];

  if (mountain_id) {
    countQuery += ' AND mountain_id = ?';
    countParams.push(mountain_id);
  }

  db.get(countQuery, countParams, (err: Error | null, countRow: any) => {
    if (err) {
      console.error('Error fetching discovery count:', err.message);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    let totalQuery = 'SELECT curated_species_count as total_species FROM mountain_biodiversity';
    const totalParams: any[] = [];

    if (mountain_id) {
      totalQuery += ' WHERE id = ?';
      totalParams.push(mountain_id);
    } else {
      totalQuery = 'SELECT SUM(curated_species_count) as total_species FROM mountain_biodiversity';
    }

    db.get(totalQuery, totalParams, (err: Error | null, totalRow: any) => {
      if (err) {
        console.error('Error fetching total species count:', err.message);
        return res.status(500).json({ error: 'Failed to fetch stats' });
      }

      const totalSpecies = totalRow.total_species || 0;
      const percentage = totalSpecies > 0
        ? Math.round((countRow.discovered_count / totalSpecies) * 100)
        : 0;

      let categoryQuery = `
        SELECT s.category, COUNT(*) as count
        FROM discoveries d
        JOIN species s ON d.species_id = s.id
        WHERE d.user_id = ?
      `;
      const categoryParams: any[] = [req.user.id];

      if (mountain_id) {
        categoryQuery += ' AND d.mountain_id = ?';
        categoryParams.push(mountain_id);
      }

      categoryQuery += ' GROUP BY s.category';

      db.all(categoryQuery, categoryParams, (err: Error | null, categoryRows: any[]) => {
        if (err) {
          console.error('Error fetching category stats:', err.message);
          return res.status(500).json({ error: 'Failed to fetch stats' });
        }

        res.json({
          discovered_count: countRow.discovered_count,
          total_species: totalSpecies,
          percentage,
          by_category: categoryRows,
        });
      });
    });
  });
});'''

text, count = stats_pattern.subn(replacement, text, count=1)
if count == 0:
    raise SystemExit('stats pattern not found')
path.write_text(text, encoding='utf-8')
print('done', count)
