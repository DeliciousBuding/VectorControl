#!/usr/bin/env python3
"""VectorControl 健康检查脚本"""
import os
import sys
import subprocess
import json
from datetime import datetime


def check_backend():
    """检查后端 API 状态"""
    try:
        result = subprocess.run(
            ["curl", "-s", "http://127.0.0.1:21345/api/healthz"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return {
            "status": "ok" if result.returncode == 0 else "error",
            "response": result.stdout[:200] if result.stdout else "No response"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


def check_frontend_build():
    """检查前端构建产物"""
    dist_path = "/home/server/VectorControl/frontend/dist"
    try:
        if os.path.exists(dist_path):
            files = os.listdir(dist_path)
            return {
                "status": "ok",
                "files_count": len(files),
                "has_index_html": "index.html" in files
            }
        return {"status": "error", "message": "dist folder not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def check_database():
    """检查数据库连接"""
    db_path = "/home/server/VectorControl/backend/data/vectorcontrol.db"
    try:
        if os.path.exists(db_path):
            size = os.path.getsize(db_path)
            return {
                "status": "ok",
                "path": db_path,
                "size_mb": round(size / (1024 * 1024), 2)
            }
        return {"status": "warning", "message": "Database not initialized yet"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def main():
    """主函数"""
    report = {
        "checked_at": datetime.now().isoformat(),
        "project": "VectorControl",
        "checks": {
            "backend_api": check_backend(),
            "frontend_build": check_frontend_build(),
            "database": check_database()
        }
    }
    
    # 统计状态
    statuses = [v["status"] for v in report["checks"].values()]
    report["summary"] = {
        "total": len(statuses),
        "ok": statuses.count("ok"),
        "warning": statuses.count("warning"),
        "error": statuses.count("error")
    }
    
    # 输出报告
    print(json.dumps(report, indent=2, ensure_ascii=False))
    
    # 返回码
    if report["summary"]["error"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
EOF
chmod +x /home/server/VectorControl/vc_health_check.py
