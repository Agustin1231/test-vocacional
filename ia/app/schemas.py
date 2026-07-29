"""Esquemas de entrada y salida del servicio de IA.

Definen el contrato HTTP (ver docs/api-contract.md y ia/DOCUMENTACION.md).

La entrada trae el mensaje del estudiante (`texto`), un identificador de sesión
(`sesion_id`) para agrupar la memoria de la conversación y, opcionalmente, el
`contexto` del informe (nombre, perfil, área y carrera) que envía el backend.

El prompt base del agente vive en la DB (editable por API). El contexto NO se
inventa: si no llega, el agente responde en modo genérico, sin nombre ni carrera.
"""
from pydantic import BaseModel


class ContextoEstudiante(BaseModel):
    """Datos del informe con los que se personaliza el asesor. Todos opcionales."""
    nombre: str | None = None
    perfil: str | None = None
    area: str | None = None
    carrera: str | None = None


class ChatRequest(BaseModel):
    """Entrada (input) del agente."""
    texto: str
    sesion_id: str
    contexto: ContextoEstudiante | None = None


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
