from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from uuid import UUID
import mercadopago
from datetime import datetime, timedelta, timezone
import json

from app.infra.database import get_db_session
from app.infra.models.user_model import UserModel
from app.adapters.http.sync_router import get_current_user_id
from app.infra.config import settings

router = APIRouter(prefix="/payments", tags=["payments"])

# Inicializa o SDK do Mercado Pago
# O token deve vir de settings.mercadopago_access_token
mp_sdk = mercadopago.SDK(getattr(settings, 'mercadopago_access_token', 'TEST-TOKEN-PLACEHOLDER'))

@router.post("/subscribe")
async def create_subscription(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Gera um link de pagamento (Checkout Pro) para assinar o LifeQuest PRO.
    """
    # A URL de retorno para onde o usuário vai após pagar
    frontend_url = getattr(settings, 'frontend_url', 'http://localhost:5173')
    
    # Criamos uma "Preferência" de pagamento avulso ou assinatura.
    # Para simplificar e evitar bloqueios em contas novas sem permissão de Subscriptions avançadas,
    # usamos uma Preference comum com validade de 30 dias (Passe PRO Mensal).
    # O usuário pode comprar novamente quando expirar, ou podemos migrar para preapproval completo.
    
    preference_data = {
        "items": [
            {
                "id": "PRO_MONTHLY",
                "title": "LifeQuest PRO (Mensal)",
                "description": "Desbloqueie IA Ilimitada, Temas e Pro Coins",
                "quantity": 1,
                "currency_id": "BRL",
                "unit_price": 4.99
            }
        ],
        # "payer": {
        #     # O ideal é pegar o email do user no banco de dados
        # },
        "back_urls": {
            "success": f"{frontend_url}?payment=success",
            "failure": f"{frontend_url}?payment=failure",
            "pending": f"{frontend_url}?payment=pending"
        },
        "external_reference": user_id,  # IMPORTANTE: Enviamos o user_id para o MP
        # Configuração do Webhook. Em produção, use sua URL (ex: https://api.lifequest.com/payments/webhook)
        # "notification_url": "https://sua-url-backend.com/payments/webhook"
    }

    # O Mercado Pago rejeita auto_return se a URL for localhost (http).
    if frontend_url.startswith("https://"):
        preference_data["auto_return"] = "approved"

    try:
        preference_response = mp_sdk.preference().create(preference_data)
        
        # O MP não levanta exceção no SDK, ele retorna um dict com 'status'
        if preference_response.get("status") not in (200, 201):
            error_msg = preference_response.get("response", {})
            print("MERCADOPAGO ERROR:", error_msg)
            raise HTTPException(status_code=500, detail=f"Erro do Mercado Pago: {error_msg}")
            
        preference = preference_response["response"]
        
        # init_point é o link para onde você deve redirecionar o usuário
        return {"checkout_url": preference["init_point"]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print("EXCEPTION:", e)
        raise HTTPException(status_code=500, detail=f"Erro interno ao gerar pagamento: {str(e)}")


@router.post("/webhook")
async def mercadopago_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Recebe os avisos do Mercado Pago quando o status de um pagamento muda.
    """
    # O MP envia o payload (data) com as informações do pagamento
    body = await request.json()
    action = body.get("action")
    data_id = body.get("data", {}).get("id")

    # Só nos importamos quando o pagamento é de fato atualizado/criado
    if action == "payment.created" or action == "payment.updated":
        if data_id:
            # Consultamos o status real do pagamento no MP por segurança (Zero Trust)
            payment_info = mp_sdk.payment().get(data_id)
            payment = payment_info.get("response", {})
            
            status = payment.get("status")
            user_id = payment.get("external_reference")  # Pegamos o ID que mandamos na Preference
            
            if status == "approved" and user_id:
                # Pagamento confirmado! Dá 30 dias de PRO.
                expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
                
                stmt = update(UserModel).where(UserModel.id == UUID(user_id)).values(
                    is_pro=True,
                    pro_expires_at=expires_at
                )
                await db.execute(stmt)
                
    return {"status": "received"}
