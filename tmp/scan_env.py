import os
import re

p_proc = re.compile(r"process\.env(?:\[[\"']([A-Za-z0-9_]+)[\"']\]|\.([A-Za-z0-9_]+))")
p_import = re.compile(r"import\.meta\.env(?:\[[\"']([A-Za-z0-9_]+)[\"']\]|\.([A-Za-z0-9_]+))")
p_env = re.compile(r"\benv(?:\[[\"']([A-Za-z0-9_]+)[\"']\]|\.([A-Za-z0-9_]+))")

ignore_dirs = {"node_modules", "dist", ".git"}

matches = []

for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    for file in files:
        if file.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")):
            filepath = os.path.join(root, file)
            if "worker-configuration.d.ts" in filepath:
                continue
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    for line_num, line in enumerate(f, 1):
                        for p in (p_proc, p_import, p_env):
                            for m in p.finditer(line):
                                var = m.group(1) or m.group(2)
                                if var:
                                    matches.append((var, filepath, line_num, line.strip()))
            except Exception as e:
                pass

for var, path, num, text in sorted(matches, key=lambda x: (x[0], x[1], x[2])):
    print(f"{var} | {path}:{num} | {text}")
