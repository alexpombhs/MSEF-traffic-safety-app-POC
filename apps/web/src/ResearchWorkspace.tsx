import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { OSMCrossing } from './osmCrossings';

export type FieldObservation = {
  id: string;
  crossingId: number;
  observedAt: string;
  pedestrians: number;
  yieldingVehicles: number;
  opportunities: number;
  avgWaitSeconds: number | null;
  markings: string;
  notes: string;
};

const STORAGE_KEY = 'msef-great-road-observations-v1';

function readObservations(): FieldObservation[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is FieldObservation =>
      typeof x === 'object' && x !== null &&
      typeof x.id === 'string' && typeof x.crossingId === 'number' &&
      typeof x.pedestrians === 'number' && typeof x.opportunities === 'number' &&
      typeof x.yieldingVehicles === 'number');
  } catch { return []; }
}

export default function ResearchWorkspace({ crossings, selectedId }: { crossings: OSMCrossing[]; selectedId: number | null }) {
  const [records, setRecords] = useState<FieldObservation[]>(readObservations);
  const [crossingId, setCrossingId] = useState<number | ''>(selectedId ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pedestrians, setPedestrians] = useState('0');
  const [opportunities, setOpportunities] = useState('0');
  const [yielding, setYielding] = useState('0');
  const [wait, setWait] = useState('');
  const [markings, setMarkings] = useState('unknown');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedId !== null) setCrossingId(selectedId);
  }, [selectedId]);

  const summary = useMemo(() => crossings.map(c => {
    const samples = records.filter(r => r.crossingId === c.id);
    const totalOpportunities = samples.reduce((n, r) => n + r.opportunities, 0);
    const yielded = samples.reduce((n, r) => n + r.yieldingVehicles, 0);
    const totalPedestrians = samples.reduce((n, r) => n + r.pedestrians, 0);
    return { id: c.id, observations: samples.length, totalOpportunities, totalPedestrians, yielded, yieldingPercent: totalOpportunities ? 100 * yielded / totalOpportunities : null };
  }).filter(item => item.observations > 0), [crossings, records]);

  function save() {
    const p = Number(pedestrians), o = Number(opportunities), y = Number(yielding);
    const w = wait.trim() === '' ? null : Number(wait);
    if (crossingId === '' || !crossings.some(c => c.id === crossingId)) return setError('Choose a mapped Great Road crossing.');
    if (!date) return setError('Choose an observation date.');
    if (![p, o, y].every(n => Number.isSafeInteger(n) && n >= 0) || y > o) {
      return setError('Counts must be whole nonnegative numbers, and yielding vehicles cannot exceed observed opportunities.');
    }
    if (w !== null && (!Number.isFinite(w) || w < 0)) return setError('Waiting time must be a nonnegative number or blank.');
    const observation: FieldObservation = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      crossingId, observedAt: date, pedestrians: p, opportunities: o,
      yieldingVehicles: y, avgWaitSeconds: w, markings, notes: notes.trim(),
    };
    try {
      const updated = [...records, observation];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setRecords(updated);
      setError('');
      setPedestrians('0'); setOpportunities('0'); setYielding('0'); setWait(''); setNotes('');
    } catch { setError('This browser could not save the record. Export any existing observations first.'); }
  }

  function exportData() {
    const data = JSON.stringify({ schema: 1, exportedAt: new Date().toISOString(), records }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'great-road-field-observations.json'; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  const fields = { minWidth: { xs: '100%', sm: 150 }, flex: 1 };
  return <Card variant="outlined" sx={{ mt: 2 }}>
    <CardContent>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" useFlexGap flexWrap="wrap">
          <Box>
            <Typography variant="h5">Field research workspace</Typography>
            <Typography variant="body2" color="text.secondary">Collect repeatable observations and compare crossing behavior.</Typography>
          </Box>
          <Chip color="info" variant="outlined" label={`${records.length} saved observations`} />
        </Stack>
        <Alert severity="info">Saved only in this browser, not synced between devices. Export a backup regularly. These are student observations, not official traffic or crash records.</Alert>
        <Typography variant="h6">Add observation</Typography>
        <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
          <TextField select label="Crossing" sx={{ ...fields, minWidth: 220 }} value={crossingId} onChange={e => setCrossingId(e.target.value === '' ? '' : Number(e.target.value))}>
            {crossings.length === 0 && <MenuItem value="">No crossings loaded</MenuItem>}
            {crossings.map(c => <MenuItem key={c.id} value={c.id}>OSM crossing #{c.id}</MenuItem>)}
          </TextField>
          <TextField type="date" label="Observation date" value={date} onChange={e => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={fields} />
          <TextField type="number" label="Pedestrians observed" value={pedestrians} onChange={e => setPedestrians(e.target.value)} sx={fields} />
          <TextField type="number" label="Vehicle yielding opportunities" value={opportunities} onChange={e => setOpportunities(e.target.value)} sx={fields} />
          <TextField type="number" label="Vehicles that yielded" value={yielding} onChange={e => setYielding(e.target.value)} sx={fields} />
          <TextField type="number" label="Average wait (seconds)" value={wait} onChange={e => setWait(e.target.value)} sx={fields} />
          <TextField select label="Markings condition" value={markings} onChange={e => setMarkings(e.target.value)} sx={fields}>
            {['unknown', 'good', 'faded', 'missing'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
        </Stack>
        <TextField label="Method, weather, visibility and notes" multiline minRows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        <Typography variant="caption" color="text.secondary">Count yielding opportunities using the same pre-defined procedure at each location. Do not enter traffic or test drivers.</Typography>
        {error && <Alert severity="warning">{error}</Alert>}
        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={!crossings.length} onClick={save}>Save observation</Button>
          <Button variant="outlined" disabled={!records.length} onClick={exportData}>Export observations</Button>
        </Stack>
        <Divider />
        <Typography variant="h6">Compare your observations</Typography>
        {summary.length === 0
          ? <Typography color="text.secondary" variant="body2">No observations yet. Add measurements at two crossings to compare them.</Typography>
          : <Stack spacing={1}>{summary.map(s => <Box key={s.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" useFlexGap flexWrap="wrap">
                <Typography fontWeight={600}>OSM crossing #{s.id}</Typography>
                <Chip size="small" label={`${s.observations} visit(s)`} />
              </Stack>
              <Typography variant="body2">{s.totalPedestrians} pedestrians observed · {s.totalOpportunities} yielding opportunities</Typography>
              <Typography variant="body2">Observed yielding: {s.yieldingPercent === null ? 'Insufficient observations' : `${s.yielded}/${s.totalOpportunities} (${s.yieldingPercent.toFixed(1)}%)`}</Typography>
            </Box>)}</Stack>}
        <Typography variant="caption" color="text.secondary">Yielding percentages are descriptive sample statistics, not a crosswalk safety score. Different times, weather, crossing geometry and sample sizes can affect results.</Typography>
      </Stack>
    </CardContent>
  </Card>;
}
