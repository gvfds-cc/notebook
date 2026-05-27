"""
AI Services 配置
"""
class Config:
    llm_model = "deepseek-chat"
    llm_api_key = None
    llm_base_url = "https://api.deepseek.com/v1"
    llm_temperature = 0.7
    embedding_model = "text-embedding-3-small"
    embedding_api_key = None
    embedding_base_url = None
    asr_app_key = None
    asr_access_key_id = None
    asr_access_key_secret = None

config = Config()
