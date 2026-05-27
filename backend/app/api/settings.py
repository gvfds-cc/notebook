"""用户配置 API"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.database import UserConfig, get_session

router = APIRouter()


class ConfigItem(BaseModel):
    key: str
    value: str | None


class ConfigResponse(BaseModel):
    llm_api_key: str | None
    llm_base_url: str | None
    llm_model: str | None
    whisper_api_key: str | None


class ConfigTestRequest(BaseModel):
    api_key: str | None
    base_url: str | None
    model: str | None


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """获取用户配置"""
    session = get_session()
    try:
        configs = session.query(UserConfig).all()
        result = {c.key: c.value for c in configs}
        return ConfigResponse(
            llm_api_key=result.get("llm_api_key"),
            llm_base_url=result.get("llm_base_url", "https://api.deepseek.com/v1"),
            llm_model=result.get("llm_model", "deepseek-chat"),
            whisper_api_key=result.get("whisper_api_key"),
        )
    finally:
        session.close()


@router.put("/config")
async def update_config(config: ConfigItem):
    """更新单个配置项"""
    session = get_session()
    try:
        existing = session.query(UserConfig).filter(UserConfig.key == config.key).first()
        if existing:
            existing.value = config.value
        else:
            new_config = UserConfig(key=config.key, value=config.value)
            session.add(new_config)
        session.commit()
        return {"message": "更新成功"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.put("/config/all")
async def update_all_config(config: ConfigResponse):
    """批量更新配置"""
    session = get_session()
    try:
        configs_to_update = [
            ("llm_api_key", config.llm_api_key),
            ("llm_base_url", config.llm_base_url),
            ("llm_model", config.llm_model),
            ("whisper_api_key", config.whisper_api_key),
        ]
        for key, value in configs_to_update:
            existing = session.query(UserConfig).filter(UserConfig.key == key).first()
            if existing:
                existing.value = value
            else:
                session.add(UserConfig(key=key, value=value))
        session.commit()
        return {"message": "更新成功"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()


@router.post("/config/test")
async def test_config(test_req: ConfigTestRequest):
    """测试API配置是否可用"""
    try:
        import openai
        client = openai.OpenAI(
            api_key=test_req.api_key,
            base_url=test_req.base_url,
            timeout=10.0,  # 10秒超时
        )
        response = client.chat.completions.create(
            model=test_req.model or "deepseek-chat",
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=10,
        )
        return {"success": True, "message": "连接成功！"}
    except Exception as e:
        return {"success": False, "message": f"连接失败: {str(e)}"}
