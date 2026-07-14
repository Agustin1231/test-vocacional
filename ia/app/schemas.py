"""Esquemas de entrada y salida del servicio de IA.

Definen el contrato HTTP (ver docs/api-contract.md y ia/DOCUMENTACION.md).

La entrada es solo `texto`: el prompt del agente, la memoria de la conversación
y el contexto del estudiante se arman DENTRO del servicio. Hoy están
hardcodeados (ver app/agent/datos_demo.py); más adelante vendrán de la base de
datos vía el backend.
"""
from pydantic import BaseModel


class ChatRequest(BaseModel):
    """Entrada (input) del agente: únicamente el mensaje del estudiante."""
    texto: str


class ChatResponse(BaseModel):
    """Salida (output) del agente."""
    reply: str
