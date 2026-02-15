from app.storage.db import list_holdings
import json

print("=== Admin holdings ===")
admin_holdings = list_holdings('admin')
print(f"Count: {len(admin_holdings)}")
if admin_holdings:
    print(json.dumps(admin_holdings, ensure_ascii=False, indent=2))

print("\n=== Legacy holdings ===")
legacy_holdings = list_holdings('legacy')
print(f"Count: {len(legacy_holdings)}")
if legacy_holdings:
    print(json.dumps(legacy_holdings[:3], ensure_ascii=False, indent=2))
    print(f"... and {len(legacy_holdings)-3} more")
