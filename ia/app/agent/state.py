"""Estado que fluye por el grafo de LangGraph.

Hoy es lineal (entra input, sale reply). Al agregar nodos/herramientas en el
futuro, este estado es donde se acumula la información compartida entre nodos.
"""
from typing import TypedDict


class AgentState(TypedDict):
    # Entrada.
    mensajes: list[dict]   # [{ "rol": "user"|"assistant", "texto": str }]
    contexto: dict         # { carrera?, area?, perfil?, nombre? }
    # Salida.
    reply: str
