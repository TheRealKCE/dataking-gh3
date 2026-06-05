import os
import glob
import re
import json
import sqlparse

def build_regex(pattern):
    return re.compile(pattern, re.IGNORECASE | re.MULTILINE)

rx = {
    'extension': build_regex(r'^\s*CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[a-zA-Z0-9_-]+"?)'),
    'type': build_regex(r'^\s*CREATE\s+TYPE\s+([a-zA-Z0-9_".]+)\s+AS\s+ENUM'),
    'table': build_regex(r'^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_".]+)'),
    'index': build_regex(r'^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_".]+)\s+ON\s+([a-zA-Z0-9_".]+)'),
    'function': build_regex(r'^\s*CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_".]+)'),
    'trigger': build_regex(r'^\s*CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z0-9_".]+)\s+(?:BEFORE|AFTER|INSTEAD OF)\s+.*?\s+ON\s+([a-zA-Z0-9_".]+)'),
    'view': build_regex(r'^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_".]+)'),
    'policy': build_regex(r'^\s*CREATE\s+POLICY\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))\s+ON\s+([a-zA-Z0-9_".]+)'),
    'alter_col': build_regex(r'^\s*ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_".]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_".]+)'),
    'alter_const': build_regex(r'^\s*ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_".]+)\s+ADD\s+CONSTRAINT\s+([a-zA-Z0-9_".]+)'),
    'alter_other': build_regex(r'^\s*ALTER\s+(?:TABLE|DEFAULT\s+PRIVILEGES|ROLE|SEQUENCE|PUBLICATION|FUNCTION)'),
    'insert': build_regex(r'^\s*INSERT\s+INTO\s+([a-zA-Z0-9_".]+)'),
    'update': build_regex(r'^\s*UPDATE\s+([a-zA-Z0-9_".]+)'),
    'delete': build_regex(r'^\s*DELETE\s+FROM\s+([a-zA-Z0-9_".]+)'),
    'grant': build_regex(r'^\s*GRANT\s+.*?\s+ON\s+(?:TABLE\s+|FUNCTION\s+|SEQUENCE\s+)?([a-zA-Z0-9_".]+)'),
    'revoke': build_regex(r'^\s*REVOKE\s+.*?\s+ON\s+(?:TABLE\s+|FUNCTION\s+|SEQUENCE\s+)?([a-zA-Z0-9_".]+)'),
    'drop': build_regex(r'^\s*DROP\s+(TABLE|VIEW|MATERIALIZED VIEW|FUNCTION|TRIGGER|POLICY|INDEX|EXTENSION|TYPE)\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_".]+)'),
    'do': build_regex(r'^\s*DO\s+\$\$'),
    'commit': build_regex(r'^\s*COMMIT'),
    'begin': build_regex(r'^\s*BEGIN'),
    'select': build_regex(r'^\s*SELECT\s+'),
    'comment': build_regex(r'^\s*COMMENT\s+ON\s+'),
    'notify': build_regex(r'^\s*NOTIFY\s+')
}

# Find all SQL files and sort them to try and process them in order
# Specifically sorting so that older migrations come first.
sql_files = glob.glob('supabase/**/*.sql', recursive=True)

# Try to sort files semi-chronologically.
# We'll put schema.sql first, then files in migrations/, then others.
def get_sort_key(f):
    base = os.path.basename(f)
    if base == 'schema.sql':
        return (0, f)
    elif 'migrations/' in f:
        # Sort migrations by name (which includes timestamp usually)
        return (1, f)
    else:
        return (2, f)

sql_files.sort(key=get_sort_key)

parsed_objects = []

for filepath in sql_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    statements = sqlparse.split(content)

    for stmt in statements:
        raw_stmt = stmt.strip()
        if not raw_stmt: continue

        clean_stmt = sqlparse.format(raw_stmt, strip_comments=True).strip()
        if not clean_stmt: continue

        obj_type = 'unknown'
        obj_name = None
        target = None

        if m := rx['extension'].search(clean_stmt):
            obj_type = 'extension'
            obj_name = m.group(1).replace('"', '')
        elif m := rx['type'].search(clean_stmt):
            obj_type = 'type'
            obj_name = m.group(1)
        elif m := rx['table'].search(clean_stmt):
            obj_type = 'table'
            obj_name = m.group(1)
        elif m := rx['index'].search(clean_stmt):
            obj_type = 'index'
            obj_name = m.group(1)
            target = m.group(2)
        elif m := rx['function'].search(clean_stmt):
            obj_type = 'function'
            obj_name = m.group(1)
        elif m := rx['trigger'].search(clean_stmt):
            obj_type = 'trigger'
            obj_name = m.group(1)
            target = m.group(2)
        elif m := rx['view'].search(clean_stmt):
            obj_type = 'view'
            obj_name = m.group(1)
        elif m := rx['policy'].search(clean_stmt):
            obj_type = 'policy'
            obj_name = m.group(1) or m.group(2)
            target = m.group(3)
        elif m := rx['alter_col'].search(clean_stmt):
            obj_type = 'alter_col'
            target = m.group(1)
            obj_name = m.group(2)
        elif m := rx['alter_const'].search(clean_stmt):
            obj_type = 'constraint'
            target = m.group(1)
            obj_name = m.group(2)
        elif m := rx['insert'].search(clean_stmt):
            obj_type = 'seed'
            target = m.group(1)
        elif m := rx['update'].search(clean_stmt):
            obj_type = 'data_mutation'
            target = m.group(1)
        elif m := rx['delete'].search(clean_stmt):
            obj_type = 'data_mutation'
            target = m.group(1)
        elif m := rx['grant'].search(clean_stmt) or rx['revoke'].search(clean_stmt):
            obj_type = 'grant'
            target = m.group(1) if m else None
        elif m := rx['do'].search(clean_stmt):
            obj_type = 'do_block'
        elif m := rx['drop'].search(clean_stmt):
            obj_type = 'drop'
            obj_name = m.group(2)
            # We want to associate drop with the target object if possible, to replace it
            target_type = m.group(1).lower()
            target = f"{target_type}:{obj_name}"
        elif clean_stmt.upper().startswith('ALTER TABLE') and ('ENABLE ROW LEVEL SECURITY' in clean_stmt.upper()):
            obj_type = 'rls_enable'
            # try to find table
            if alter_m := re.search(r'^\s*ALTER\s+TABLE\s+([a-zA-Z0-9_".]+)', clean_stmt, re.I):
                target = alter_m.group(1)
        elif m := rx['alter_other'].search(clean_stmt):
            obj_type = 'alter_other'
        elif rx['commit'].search(clean_stmt) or rx['begin'].search(clean_stmt):
            obj_type = 'transaction'
        elif rx['select'].search(clean_stmt):
            obj_type = 'query'
        elif rx['comment'].search(clean_stmt):
            obj_type = 'comment'
        elif rx['notify'].search(clean_stmt):
            obj_type = 'notify'
        else:
            obj_type = 'other'

        parsed_objects.append({
            'type': obj_type,
            'name': obj_name,
            'target': target,
            'raw': raw_stmt,
            'clean': clean_stmt,
            'file': filepath
        })

categories = {
    'extension': [],
    'type': [],
    'table': [],
    'alter_col': [],
    'constraint': [],
    'index': [],
    'function': [],
    'trigger': [],
    'view': [],
    'rls_enable': [],
    'policy': [],
    'seed': [],
    'data_mutation': [],
    'grant': [],
    'do_block': [],
    'alter_other': [],
    'comment': [],
    'notify': [],
    'transaction': [],
    'query': [],
    'other': []
}

# Smart Deduplication Strategy
# Because objects might be updated (e.g. CREATE OR REPLACE FUNCTION),
# we want to keep the LATEST definition of an object and discard previous ones.
# Also, explicit drops should be applied immediately or we can just ignore explicit drops
# entirely since our creates are idempotent and replacing (OR REPLACE, IF NOT EXISTS).
# In fact, dropping objects that might have dependent objects is dangerous. We will NOT output explicit drops.
# By making creations idempotent (OR REPLACE or IF NOT EXISTS), the drop is implicitly not needed.
# For functions and views: Keep only the latest definition.
# For tables: Keep the first CREATE TABLE (the schema init), keep subsequent ALTER COLUMNS.
# For policies: Keep the latest definition based on name and target table.
# For triggers: Keep the latest definition based on name and target table.

dedup_map = {
    'function': {}, # name -> obj
    'view': {},     # name -> obj
    'policy': {},   # (name, target) -> obj
    'trigger': {},  # (name, target) -> obj
    'table': {},    # name -> obj
    'index': {},    # name -> obj
    'type': {},     # name -> obj
    'extension': {} # name -> obj
}

def get_obj_key(obj):
    t = obj['type']
    if t in ['function', 'view', 'table', 'index', 'type', 'extension']:
        return obj['name']
    elif t in ['policy', 'trigger']:
        return (obj['name'], obj['target'])
    return None

duplicates_skipped = 0
dropped_statements = 0

for obj in parsed_objects:
    t = obj['type']

    if t == 'drop':
        # Ignore drops. We make objects idempotent.
        dropped_statements += 1
        continue

    key = get_obj_key(obj)
    if key:
        if t == 'table' or t == 'index' or t == 'type' or t == 'extension':
            # For tables/indexes/types, the first definition defines it. Subsequent might be identical or errors.
            # We keep the first one we see.
            if key not in dedup_map[t]:
                dedup_map[t][key] = obj
                categories[t].append(obj)
            else:
                duplicates_skipped += 1
        else:
            # For functions/views/policies/triggers, the LAST definition wins.
            # We will overwrite the previous reference.
            if key in dedup_map[t]:
                duplicates_skipped += 1
                # Replace the old obj in the category list with the new one
                idx = categories[t].index(dedup_map[t][key])
                categories[t][idx] = obj
                dedup_map[t][key] = obj
            else:
                dedup_map[t][key] = obj
                categories[t].append(obj)
    else:
        # Non-deduplicatable statements (alters, seeds, do blocks)
        # We can try exact string match deduplication for these
        stmt_hash = hash(obj['clean'])
        if not hasattr(get_obj_key, 'seen_hashes'):
            get_obj_key.seen_hashes = set()

        if stmt_hash in get_obj_key.seen_hashes:
            duplicates_skipped += 1
        else:
            get_obj_key.seen_hashes.add(stmt_hash)
            if t in categories:
                categories[t].append(obj)
            else:
                categories['other'].append(obj)

def make_idempotent(obj):
    t = obj['type']
    sql = obj['raw']
    c_sql = obj['clean']

    if t == 'extension':
        if 'IF NOT EXISTS' not in c_sql.upper():
            sql = re.sub(r'CREATE\s+EXTENSION', 'CREATE EXTENSION IF NOT EXISTS', sql, flags=re.I)
    elif t == 'table':
        if 'IF NOT EXISTS' not in c_sql.upper():
            sql = re.sub(r'CREATE\s+TABLE', 'CREATE TABLE IF NOT EXISTS', sql, flags=re.I)
    elif t == 'index':
        if 'IF NOT EXISTS' not in c_sql.upper():
            sql = re.sub(r'CREATE\s+(UNIQUE\s+)?INDEX', r'CREATE \1INDEX IF NOT EXISTS', sql, flags=re.I)
    elif t == 'type':
        name = obj['name']
        if name:
            sql = f"""DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{name.split('.')[-1]}') THEN
        {sql}
    END IF;
END $idempotent_block$;"""
    elif t == 'alter_col':
        if 'IF NOT EXISTS' not in c_sql.upper():
            sql = re.sub(r'ADD\s+COLUMN', 'ADD COLUMN IF NOT EXISTS', sql, flags=re.I)
        # Even with IF NOT EXISTS, alters can be noisy if the table doesn't exist, but our dependency ordering should prevent this.
        # Just in case, wrap in exception handler:
        sql = f"""DO $idempotent_block$
BEGIN
    {sql}
EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN undefined_table THEN NULL;
END $idempotent_block$;"""
    elif t == 'constraint':
        name = obj['name']
        if name:
            sql = f"""DO $idempotent_block$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{name}') THEN
        {sql}
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;"""
    elif t == 'function':
        if 'CREATE OR REPLACE' not in c_sql.upper():
            sql = re.sub(r'CREATE\s+FUNCTION', 'CREATE OR REPLACE FUNCTION', sql, flags=re.I)
    elif t == 'trigger':
        name = obj['name']
        target = obj['target']
        if name and target:
            sql = f"DROP TRIGGER IF EXISTS {name} ON {target};\n{sql}"
    elif t == 'view':
        if 'CREATE OR REPLACE' not in c_sql.upper():
            sql = re.sub(r'CREATE\s+VIEW', 'CREATE OR REPLACE VIEW', sql, flags=re.I)
    elif t == 'policy':
        name = obj['name']
        target = obj['target']
        if name and target:
            safe_name = name.replace("'", "''")
            sql = f"""DO $idempotent_block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = '{safe_name}' AND tablename = '{target.split('.')[-1]}'
    ) THEN
        {sql}
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $idempotent_block$;"""
    elif t == 'seed':
        if 'ON CONFLICT' not in c_sql.upper():
            sql = f"""DO $idempotent_block$
BEGIN
    {sql}
EXCEPTION
    WHEN unique_violation THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;"""
    elif t in ['alter_other', 'data_mutation', 'do_block']:
        sql = f"""DO $idempotent_block$
BEGIN
    {sql}
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    WHEN others THEN NULL;
END $idempotent_block$;"""
    elif t == 'rls_enable':
        sql = f"""DO $idempotent_block$
BEGIN
    {sql}
EXCEPTION
    WHEN others THEN NULL;
END $idempotent_block$;"""

    return sql

with open('master_supabase_setup.sql', 'w', encoding='utf-8') as out:
    out.write("-- ==========================================\n")
    out.write("-- MASTER SUPABASE DEPLOYMENT SCRIPT\n")
    out.write("-- Auto-generated consolidation of all SQL migrations and scripts\n")
    out.write("-- ==========================================\n\n")

    order = [
        ('extension', '1. EXTENSIONS'),
        ('type', '2. ENUMS & TYPES'),
        ('table', '3. TABLES'),
        ('alter_col', '4. ALTER COLUMNS'),
        ('constraint', '5. CONSTRAINTS'),
        ('index', '6. INDEXES'),
        ('function', '7. FUNCTIONS'),
        ('view', '8. VIEWS'),
        ('trigger', '9. TRIGGERS'),
        ('rls_enable', '10. ENABLE RLS'),
        ('policy', '11. POLICIES'),
        ('grant', '12. GRANTS & REVOKES'),
        ('do_block', '13. PROCEDURAL BLOCKS'),
        ('seed', '14. SEED DATA'),
        ('data_mutation', '15. DATA MUTATIONS'),
        ('alter_other', '16. OTHER ALTERS'),
        ('comment', '17. COMMENTS'),
        ('notify', '18. NOTIFICATIONS'),
        ('other', '19. OTHER STATEMENTS')
    ]

    for cat_key, title in order:
        if not categories[cat_key]: continue
        out.write(f"\n\n-- {'='*50}\n")
        out.write(f"-- {title}\n")
        out.write(f"-- {'='*50}\n\n")

        for obj in categories[cat_key]:
            if obj['type'] in ['transaction', 'query']: continue
            out.write(f"-- Source: {obj['file']}\n")
            idempotent_sql = make_idempotent(obj)
            out.write(f"{idempotent_sql}\n\n")

with open('migration_audit_report.md', 'w', encoding='utf-8') as out:
    out.write("# Supabase Migration Audit Report\n\n")
    out.write("## Summary\n")
    out.write(f"- Total SQL files parsed: {len(sql_files)}\n")
    out.write(f"- Total statements found: {len(parsed_objects)}\n")
    out.write(f"- Explicit drops skipped: {dropped_statements}\n")
    out.write(f"- Obsolete definitions skipped: {duplicates_skipped}\n")
    out.write(f"- Total unique statements processed: {len(parsed_objects) - dropped_statements - duplicates_skipped}\n\n")

    out.write("## Objects Discovered & Categorized\n")
    for cat_key, title in order:
        count = len(categories[cat_key])
        if count > 0:
            out.write(f"- **{title}**: {count}\n")

    out.write("\n## Skipped Read-Only Queries\n")
    out.write(f"- **Queries (SELECTs)**: {len(categories['query'])}\n")

    out.write("\n## Manual Review Items\n")
    if len(categories['other']) > 0:
        out.write("The following statements were classified as 'other' and should be reviewed:\n\n")
        for obj in categories['other']:
            out.write(f"- File: `{obj['file']}`\n")
            out.write(f"  ```sql\n  {obj['clean'][:100]}...\n  ```\n")
    else:
        out.write("No unclassified statements found!\n")

print("Successfully regenerated master_supabase_setup.sql and migration_audit_report.md")
