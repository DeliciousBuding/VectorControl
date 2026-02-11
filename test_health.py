#!/usr/bin/env python3
"""
测试健康检查模块
"""

import sys
sys.path.insert(0, '/home/server/VectorControl/backend')

from app.api.routers.health import (
    check_database_health,
    get_system_metrics,
    HealthStatus
)

def test_database_check():
    """测试数据库健康检查"""
    print("测试数据库健康检查...")
    result = check_database_health()
    print(f"  数据库连接: {result.connected}")
    print(f"  数据库类型: {result.database_type}")
    print(f"  数据库大小: {result.database_size_mb} MB")
    print(f"  延迟: {result.latency_ms} ms")
    return result.connected

def test_system_metrics():
    """测试系统指标收集"""
    print("\n测试系统指标收集...")
    metrics = get_system_metrics()
    print(f"  CPU 使用率: {metrics.cpu_percent}%")
    print(f"  内存使用率: {metrics.memory_percent}%")
    print(f"  内存使用: {metrics.memory_used_mb:.2f} / {metrics.memory_total_mb:.2f} MB")
    print(f"  磁盘使用率: {metrics.disk_percent}%")
    return True

def test_health_check():
    """测试健康检查端点"""
    print("\n测试健康检查响应...")
    
    # 模拟健康检查
    db_status = check_database_health()
    system_metrics = get_system_metrics()
    
    # 确定整体状态
    overall_status = "healthy"
    if not db_status.connected:
        overall_status = "unhealthy"
    elif system_metrics.cpu_percent > 90 or system_metrics.memory_percent > 90:
        overall_status = "degraded"
    
    print(f"  整体状态: {overall_status}")
    print(f"  数据库连接: {'正常' if db_status.connected else '异常'}")
    print(f"  系统负载: CPU {system_metrics.cpu_percent}%, 内存 {system_metrics.memory_percent}%")
    
    return overall_status == "healthy"

def main():
    """主函数"""
    print("=" * 60)
    print("VectorControl 健康检查模块测试")
    print("=" * 60)
    
    try:
        # 运行所有测试
        db_ok = test_database_check()
        system_ok = test_system_metrics()
        health_ok = test_health_check()
        
        # 输出总结
        print("\n" + "=" * 60)
        print("测试总结")
        print("=" * 60)
        print(f"数据库检查: {'通过' if db_ok else '失败'}")
        print(f"系统指标: {'通过' if system_ok else '失败'}")
        print(f"健康检查: {'通过' if health_ok else '失败'}")
        
        all_passed = db_ok and system_ok and health_ok
        print(f"\n整体结果: {'全部通过' if all_passed else '部分失败'}")
        
        return 0 if all_passed else 1
        
    except Exception as e:
        print(f"\n测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
