import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

const repoRoot = path.resolve(__dirname, '../../../../../');
const DASHBOARDS = path.join(repoRoot, 'infra/observability/dashboards');
const CONFIG_MAPS = path.join(repoRoot, 'infra/k8s/base/dashboards-configmaps.yaml');

const sources = fs.readdirSync(DASHBOARDS).filter((file) => file.endsWith('.json'));
const dashboard = (file: string): unknown =>
  JSON.parse(fs.readFileSync(path.join(DASHBOARDS, file), 'utf8'));

function configMapDashboards(): Map<string, unknown> {
  const docs = yaml.loadAll(fs.readFileSync(CONFIG_MAPS, 'utf8')) as {
    data: Record<string, string>;
  }[];
  return new Map(
    docs.flatMap(({ data }) => Object.entries(data).map(([file, json]) => [file, JSON.parse(json)]))
  );
}

describe('infra/observability: dashboards', () => {
  it('ships every dashboard to the cluster as it is in the repo', () => {
    const shipped = configMapDashboards();

    expect([...shipped.keys()].sort()).toEqual([...sources].sort());
    for (const file of sources) expect(shipped.get(file), file).toEqual(dashboard(file));
  });

  it.each(sources)('%s reads no Neon usage, which nothing exports', (file) => {
    expect(JSON.stringify(dashboard(file))).not.toMatch(/neon_compute_hours_used|vector\(12\.5\)/);
  });
});
