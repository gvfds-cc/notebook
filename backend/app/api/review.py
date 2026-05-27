"""复习计划 API"""
from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.models.database import ReviewPlan, get_session
from app.models.schemas import ReviewTaskCreate, ReviewTaskUpdate, ReviewTaskResponse

router = APIRouter()


def _plan_to_response(plan: ReviewPlan) -> ReviewTaskResponse:
    return ReviewTaskResponse(
        id=plan.id,
        knowledge_id=plan.knowledge_id,
        note_id=plan.note_id,
        title=plan.title,
        scheduled_time=plan.scheduled_time,
        interval_label=plan.interval_label,
        status=plan.status,
        created_at=plan.created_at,
        completed_at=plan.completed_at,
    )


@router.get("/plan", response_model=list[ReviewTaskResponse])
async def get_review_plan():
    """获取当前复习计划"""
    session = get_session()
    try:
        plans = session.query(ReviewPlan).order_by(ReviewPlan.scheduled_time.asc()).all()
        return [_plan_to_response(p) for p in plans]
    finally:
        session.close()


@router.post("/plan", response_model=ReviewTaskResponse)
async def create_review_task(data: ReviewTaskCreate):
    """创建复习任务"""
    session = get_session()
    try:
        plan = ReviewPlan(
            knowledge_id=data.knowledge_id,
            note_id=data.note_id,
            title=data.title,
            scheduled_time=data.scheduled_time,
            interval_label=data.interval_label,
        )
        session.add(plan)
        session.commit()
        session.refresh(plan)
        return _plan_to_response(plan)
    finally:
        session.close()


@router.post("/plan/{task_id}/done", response_model=ReviewTaskResponse)
async def mark_review_done(task_id: str):
    """标记复习完成"""
    session = get_session()
    try:
        plan = session.query(ReviewPlan).filter(ReviewPlan.id == task_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="复习任务不存在")
        plan.status = "completed"
        plan.completed_at = datetime.now()
        session.commit()
        session.refresh(plan)
        return _plan_to_response(plan)
    finally:
        session.close()


@router.post("/plan/{task_id}/skip", response_model=ReviewTaskResponse)
async def mark_review_skipped(task_id: str):
    """跳过本次复习"""
    session = get_session()
    try:
        plan = session.query(ReviewPlan).filter(ReviewPlan.id == task_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="复习任务不存在")
        plan.status = "skipped"
        session.commit()
        session.refresh(plan)
        return _plan_to_response(plan)
    finally:
        session.close()


@router.put("/plan/{task_id}", response_model=ReviewTaskResponse)
async def update_review_task(task_id: str, data: ReviewTaskUpdate):
    """更新复习任务状态"""
    session = get_session()
    try:
        plan = session.query(ReviewPlan).filter(ReviewPlan.id == task_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="复习任务不存在")
        if data.status is not None:
            plan.status = data.status
        session.commit()
        session.refresh(plan)
        return _plan_to_response(plan)
    finally:
        session.close()


@router.post("/seed-sample", response_model=list[ReviewTaskResponse])
async def seed_sample_data():
    """生成示例复习数据"""
    from datetime import timedelta
    from app.models.database import Note, KnowledgePoint, ReviewPlan, get_session

    session = get_session()
    try:
        # 删除旧的示例数据（按标题判断）
        old_notes = session.query(Note).filter(
            Note.title.in_(["数据结构基础", "操作系统原理", "软件工程概论", "设计模式", "算法基础", "计算机网络"])
        ).all()
        for note in old_notes:
            # 删除关联的复习计划
            session.query(ReviewPlan).filter(ReviewPlan.note_id == note.id).delete()
            # 删除关联的知识点
            session.query(KnowledgePoint).filter(KnowledgePoint.note_id == note.id).delete()
            # 删除笔记
            session.delete(note)
        session.commit()

        now = datetime.now()

        # 示例笔记数据 - 包含不同时间创建的笔记
        sample_data = [
            # 一个月前的笔记 - 大部分已完成复习
            {
                "title": "数据结构基础",
                "content": "# 数据结构基础\n\n数据结构是计算机存储、组织数据的方式。",
                "tags": ["数据结构", "经典"],
                "created_offset": timedelta(days=30),  # 一个月前创建
                "knowledge_points": [
                    # 已完成
                    ("数组与链表", now - timedelta(days=25), "completed"),
                    ("栈和队列", now - timedelta(days=20), "completed"),
                    # 紧急 - 刚刚到期
                    ("二叉树遍历", now - timedelta(hours=2), "pending"),
                    # 普通
                    ("图的基础", now + timedelta(days=1), "pending"),
                    ("排序算法回顾", now + timedelta(days=3), "pending"),
                ]
            },
            # 一周前的笔记 - 部分已完成
            {
                "title": "操作系统原理",
                "content": "# 操作系统原理\n\n操作系统是管理计算机硬件和软件资源的系统软件。",
                "tags": ["操作系统", "核心"],
                "created_offset": timedelta(days=7),  # 一周前创建
                "knowledge_points": [
                    # 已完成
                    ("进程与线程", now - timedelta(days=3), "completed"),
                    # 紧急
                    ("进程调度算法", now - timedelta(hours=5), "pending"),
                    ("内存管理", now + timedelta(hours=10), "pending"),
                    # 普通
                    ("文件系统", now + timedelta(days=2), "pending"),
                    ("死锁避免", now + timedelta(days=4), "pending"),
                ]
            },
            # 当天的笔记 - 刚开始复习
            {
                "title": "软件工程概论",
                "content": "# 软件工程概论\n\n软件工程是研究和应用如何系统化、规范化、可量化地开发和维护软件的方法论。",
                "tags": ["软件工程", "基础"],
                "created_offset": timedelta(hours=2),  # 2小时前创建
                "knowledge_points": [
                    ("软件工程的定义", now + timedelta(hours=2)),      # 紧急 - 2小时后
                    ("软件生命周期模型", now + timedelta(hours=12)),   # 紧急 - 12小时后
                    ("需求分析方法", now + timedelta(days=2)),        # 普通 - 2天后
                    ("软件测试策略", now + timedelta(days=4)),        # 普通 - 4天后
                    ("项目管理基础", now + timedelta(days=5)),        # 即将到来 - 5天后
                ]
            },
            {
                "title": "设计模式",
                "content": "# 设计模式\n\n设计模式是软件设计中常见问题的典型解决方案。",
                "tags": ["设计模式", "进阶"],
                "created_offset": timedelta(hours=3),  # 3小时前创建
                "knowledge_points": [
                    ("单例模式", now + timedelta(hours=1)),           # 紧急 - 1小时后
                    ("工厂模式", now + timedelta(hours=6)),           # 紧急 - 6小时后
                    ("观察者模式", now + timedelta(days=1.5)),        # 普通 - 1.5天后
                    ("装饰器模式", now + timedelta(days=3)),          # 普通 - 3天后
                    ("策略模式", now + timedelta(days=6)),            # 即将到来 - 6天后
                ]
            },
            {
                "title": "算法基础",
                "content": "# 算法基础\n\n算法是解决问题的有限步骤描述。",
                "tags": ["算法", "面试必考"],
                "created_offset": timedelta(hours=4),  # 4小时前创建
                "knowledge_points": [
                    ("时间复杂度", now + timedelta(hours=3)),          # 紧急 - 3小时后
                    ("空间复杂度", now + timedelta(hours=8)),         # 紧急 - 8小时后
                    ("排序算法", now + timedelta(days=2.5)),           # 普通 - 2.5天后
                    ("查找算法", now + timedelta(days=4.5)),          # 普通 - 4.5天后
                    ("图算法基础", now + timedelta(days=7)),           # 即将到来 - 7天后
                ]
            },
            {
                "title": "计算机网络",
                "content": "# 计算机网络\n\n计算机网络是互联的计算机系统及其外部设备通过通信介质连接起来实现资源共享和通信的系统。",
                "tags": ["计算机网络", "基础知识"],
                "created_offset": timedelta(hours=5),  # 5小时前创建
                "knowledge_points": [
                    ("OSI七层模型", now + timedelta(hours=4)),         # 紧急 - 4小时后
                    ("TCP/IP协议", now + timedelta(hours=10)),        # 紧急 - 10小时后
                    ("HTTP协议详解", now + timedelta(days=2)),        # 普通 - 2天后
                    ("DNS原理", now + timedelta(days=3.5)),           # 普通 - 3.5天后
                    ("网络安全基础", now + timedelta(days=8)),          # 即将到来 - 8天后
                ]
            },
        ]

        created_plans = []

        for note_data in sample_data:
            # 在内容前添加示例标记
            sample_prefix = "> 📋 **示例文件** — 这是系统自动生成的示例数据，仅供参考\n\n"
            sample_content = sample_prefix + note_data["content"]

            # 创建笔记
            note = Note(
                title=note_data["title"],
                content=sample_content,
                tags=note_data["tags"],
                raw_markdown=sample_content,
                created_at=now - note_data.get("created_offset", timedelta(0)),
            )
            session.add(note)
            session.flush()

            # 为每个知识点创建复习计划
            for i, kp_info in enumerate(note_data["knowledge_points"]):
                # 兼容新旧格式：kp_info 可以是 (content, time) 或 (content, time, status)
                if len(kp_info) == 3:
                    kp_content, scheduled_time, status = kp_info
                else:
                    kp_content, scheduled_time = kp_info
                    status = "pending"

                # 创建知识点
                kp = KnowledgePoint(
                    note_id=note.id,
                    content=kp_content,
                    source="sample",
                    weight=0.8,
                )
                session.add(kp)
                session.flush()

                # 创建复习计划
                plan = ReviewPlan(
                    knowledge_id=kp.id,
                    note_id=note.id,
                    title=kp_content,
                    scheduled_time=scheduled_time,
                    interval_label=f"第{i+1}次复习",
                    status=status,
                    completed_at=datetime.now() if status == "completed" else None,
                )
                session.add(plan)
                created_plans.append(plan)

        session.commit()

        # 返回创建的任务
        return [_plan_to_response(p) for p in created_plans]

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"生成示例数据失败: {str(e)}")
    finally:
        session.close()
