"""
增强健康检查路由
提供系统状态、数据库连接、性能指标等详细信息
"""

import time
import psutil
import sqlite3
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config_loader import get_settings
from app.core.database import get_db

router = APIRouter(prefix="/health", tags=["health"])


class HealthStatus(BaseModel):
    """健康状态响应模型"""
    status: str
    timestamp: str
    version: str
    uptime_seconds: float
    checks: Dict[str, Any]


class DatabaseStatus(BaseModel):
    """数据库状态模型"""
    connected: bool
    database_type: str
    database_size_mb: float
    connection_pool_size: int
    active_connections: int
    latency_ms: float


class SystemMetrics(BaseModel):
    """系统指标模型"""
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_total_mb: float
    disk_percent: float
    disk_used_gb: float
    disk_total_gb: float


def get_system_metrics() -> SystemMetrics:
    """获取系统性能指标"""
    # CPU 使用率
    cpu_percent = psutil.cpu_percent(interval=0.1)
    
    # 内存使用率
    memory = psutil.virtual_memory()
    memory_percent = memory.percent
    memory_used_mb = memory.used / (1024 * 1024)
    memory_total_mb = memory.total / (1024 * 1024)
    
    # 磁盘使用率
    disk = psutil.disk_usage('/')
    disk_percent = (disk.used / disk.total) * 100
    disk_used_gb = disk.used / (1024 * 1024 * 1024)
    disk_total_gb = disk.total / (1024 * 1024 * 1024)
    
    return SystemMetrics(
        cpu_percent=round(cpu_percent, 2),
        memory_percent=round(memory_percent, 2),
        memory_used_mb=round(memory_used_mb, 2),
        memory_total_mb=round(memory_total_mb, 2),
        disk_percent=round(disk_percent, 2),
        disk_used_gb=round(disk_used_gb, 2),
        disk_total_gb=round(disk_total_gb, 2)
    )


def check_database_health() -> DatabaseStatus:
    """检查数据库健康状态"""
    settings = get_settings()
    db_path = settings.database_url.replace("sqlite:///", "")
    
    start_time = time.time()
    try:
        # 测试数据库连接
        conn = sqlite3.connect(db_path, timeout=5.0)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        conn.close()
        
        latency_ms = (time.time() - start_time) * 1000
        
        # 获取数据库文件大小
        db_size_mb = 0.0
        if os.path.exists(db_path):
            db_size_mb = os.path.getsize(db_path) / (1024 * 1024)
        
        return DatabaseStatus(
            connected=True,
            database_type="sqlite",
            database_size_mb=round(db_size_mb, 2),
            connection_pool_size=5,  # SQLite 默认
            active_connections=1,
            latency_ms=round(latency_ms, 2)
        )
    except Exception as e:
        return DatabaseStatus(
            connected=False,
            database_type="sqlite",
            database_size_mb=0.0,
            connection_pool_size=0,
            active_connections=0,
            latency_ms=0.0
        )


@router.get("/", response_model=HealthStatus)
async def health_check():
    """
    基础健康检查端点
    返回系统整体健康状态
    """
    checks = {
        "api": {"status": "ok", "message": "API is running"},
        "timestamp": datetime.now().isoformat()
    }
    
    return HealthStatus(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version="1.0.0",
        uptime_seconds=0.0,
        checks=checks
    )


@router.get("/detailed")
async def detailed_health_check():
    """
    详细健康检查端点
    返回系统各项指标和状态
    """
    # 获取各项检查
    db_status = check_database_health()
    system_metrics = get_system_metrics()
    
    # 确定整体状态
    overall_status = "healthy"
    if not db_status.connected:
        overall_status = "unhealthy"
    elif system_metrics.cpu_percent > 90 or system_metrics.memory_percent > 90:
        overall_status = "degraded"
    
    return {
        "status": overall_status,
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "checks": {
            "database": db_status.dict(),
            "system": system_metrics.dict()
        },
        "summary": {
            "database_connected": db_status.connected,
            "cpu_usage": f"{system_metrics.cpu_percent}%",
            "memory_usage": f"{system_metrics.memory_percent}%",
            "disk_usage": f"{system_metrics.disk_percent}%"
        }
    }


@router.get("/live")
async def liveness_check():
    """
    存活检查端点
    Kubernetes 等容器编排系统使用
    """
    return {"status": "alive", "timestamp": datetime.now().isoformat()}


@router.get("/ready")
async def readiness_check():
    """
    就绪检查端点
    检查应用是否准备好接收流量
    """
    # 检查数据库连接
    db_status = check_database_health()
    
    if db_status.connected:
        return {
            "status": "ready",
            "timestamp": datetime.now().isoformat(),
            "checks": {"database": "connected"}
        }
    else:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not ready",
                "timestamp": datetime.now().isoformat(),
                "checks": {"database": "disconnected"}
            }
        )