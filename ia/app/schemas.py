"""Esquemas de entrada y salida del servicio de IA.

Definen el contrato HTTP (ver docs/api-contract.md y ia/DOCUMENTACION.md).
El frontend ya consume este formato en ai-chat.service.ts.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Mensaje(BaseModel):
    """Un turno de la conversación."""
    rol: Literal["user", "assistant"]
    texto: str


class Contexto(BaseModel):
    """Datos opcionales para personalizar la respuesta del asesor."""
    carrera: Optional[str] = None
    area: Optional[str] = None
    perfil: Optional[str] = None
    nombre: Optional[str] = None


class ChatRequest(BaseModel):
    """Entrada (input) del agente."""
    mensajes: list[Mensaje] = Field(default_factory=list)
    contexto: Contexto = Field(default_factory=Contexto)


class ChatResponse(BaseModel):
    """Salida (output) del agente."""
    reply: str
