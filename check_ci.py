import urllib.request, json
req = urllib.request.Request('https://api.github.com/repos/szebest/taitube-platform/actions/runs?branch=ticket/80-ci-test-pipeline-optimization-speed')
req.add_header('User-Agent', 'Mozilla/5.0')
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    runs = data.get('workflow_runs', [])
    if runs:
        print(f"ID: {runs[0]['id']}, Status: {runs[0]['status']}, Conclusion: {runs[0]['conclusion']}")
    else:
        print('No runs found.')
