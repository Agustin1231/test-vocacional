"""Estado que fluye por el grafo de LangGraph.

`mensajes`, `contexto` y `reply` son el contrato con `main.py` y no cambian.
`conversacion` y `vueltas_herramientas` son internos del grafo: aparecen cuando
el modelo pide una herramienta y el ciclo agente -> herramientas -> agente tiene
que acordarse de lo que ya pasó.
"""
from typing import TypedDict

from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    # Entrada.
    mensajes: list[dict]   # [{ "rol": "user"|"assistant", "texto": str }]
    contexto: dict         # { carrera?, area?, perfil?, nombre? }
    # Salida.
    reply: str

    # --- Interno del grafo ---
    # Los mensajes tal como los ve el modelo: el system prompt, el historial y lo
    # que se vaya sumando (pedidos de herramienta y sus resultados). Se reemplaza
    # entero en cada nodo en lugar de acumularse con un reducer, para que leerlo
    # sea "esto es lo que se le mandó al modelo" y nada más.
    conversacion: list[BaseMessage]
    # Cuántas rondas de herramientas se ejecutaron. Acota el ciclo: sin esto, un
    # modelo que insiste en llamar la herramienta gira para siempre.
    vueltas_herramientas: int
