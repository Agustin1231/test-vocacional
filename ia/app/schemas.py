"""Esquemas de entrada y salida del servicio de IA.

Definen el contrato HTTP (ver docs/api-contract.md y ia/DOCUMENTACION.md).

La entrada trae el mensaje del estudiante (`texto`) y un identificador de sesión
(`sesion_id`) para agrupar la memoria de la conversación. El prompt del agente y
el contexto del estudiante se arman DENTRO del servicio (el contexto hoy está
hardcodeado, ver app/agent/datos_demo.py; luego vendrá de la base de datos).
"""
from pydantic import BaseModel


class ChatRequest(BaseModel):
    """Entrada (input) del agente."""
    texto: str
    sesion_id: str


class ChatResponse(BaseModel):
    """Salida (output) del agente."""
    reply: str


class InstruccionRequest(BaseModel):
    """Cuerpo para actualizar las instrucciones del agente."""
    contenido: str


class InstruccionResponse(BaseModel):
    """Instrucción del agente almacenada en la DB."""
    clave: str
    contenido: str
    actualizado_en: str | None = None
