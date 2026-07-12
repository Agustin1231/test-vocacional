import { CommonModule } from '@angular/common';
import {
  AfterViewChecked, Component, ElementRef, inject, signal, ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AiChatService, ChatContext } from '../../core/services/ai-chat.service';
import { TestStateService } from '../../core/services/test-state.service';
import { PROFILES } from '../../core/data/profiles.data';
import { ChatMessage } from '../../core/models/test.models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="screen animate-in chat">
      <div class="chat-head">
        <div class="asesor-avatar">🧭</div>
        <div>
          <h1>Asesor Académico IA</h1>
          <p class="status mono">
            <span class="dot"></span> UNIAGRARIA · en línea
          </p>
        </div>
        <a routerLink="/resultado" class="btn-ghost small back">← Mi resultado</a>
      </div>

      <div #scroller class="chat-body">
        @for (m of mensajes(); track $index) {
          <div class="msg" [class.user]="m.role === 'user'">
            <div class="bubble" [innerHTML]="formato(m.content)"></div>
          </div>
        }
        @if (cargando()) {
          <div class="msg">
            <div class="bubble typing"><span></span><span></span><span></span></div>
          </div>
        }
      </div>

      <div class="suggests">
        @for (s of sugerencias; track s) {
          <button class="btn-ghost small" (click)="enviar(s)" [disabled]="cargando()">{{ s }}</button>
        }
      </div>

      <form class="chat-input" (ngSubmit)="enviar(texto)">
        <input type="text" [(ngModel)]="texto" name="msg"
               placeholder="Escribe tu pregunta sobre tu carrera o UNIAGRARIA…"
               [disabled]="cargando()" autocomplete="off" />
        <button type="submit" class="btn-primary" [disabled]="cargando() || !texto.trim()">
          Enviar
        </button>
      </form>
    </section>
  `,
  styles: [
    `
      .chat {
        max-width: 780px;
        display: flex;
        flex-direction: column;
        min-height: 70vh;
      }
      .chat-head {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 20px;
      }
      .chat-head h1 {
        font-size: 1.3rem;
      }
      .asesor-avatar {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: linear-gradient(140deg, var(--uni-green-deep), var(--uni-green));
        display: grid;
        place-items: center;
        font-size: 1.6rem;
      }
      .status {
        font-size: 0.74rem;
        color: var(--ink-faint);
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 3px 0 0;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--uni-green);
        box-shadow: 0 0 8px var(--uni-green);
      }
      .back {
        margin-left: auto;
      }
      .chat-body {
        flex: 1;
        background: var(--surface);
        border: 1px solid var(--rule);
        border-radius: var(--radius);
        padding: 22px;
        overflow-y: auto;
        max-height: 52vh;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .msg {
        display: flex;
      }
      .msg.user {
        justify-content: flex-end;
      }
      .bubble {
        max-width: 80%;
        padding: 13px 16px;
        border-radius: 16px;
        font-size: 0.96rem;
        line-height: 1.55;
        background: var(--surface-2);
        border: 1px solid var(--rule);
        color: var(--ink);
        border-bottom-left-radius: 4px;
      }
      .msg.user .bubble {
        background: var(--uni-green-deep);
        border-color: transparent;
        color: var(--uni-cream);
        border-radius: 16px;
        border-bottom-right-radius: 4px;
      }
      .bubble :global(a) {
        color: var(--uni-green);
      }
      .typing {
        display: flex;
        gap: 5px;
      }
      .typing span {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--ink-faint);
        animation: blink 1.2s infinite both;
      }
      .typing span:nth-child(2) { animation-delay: 0.2s; }
      .typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes blink {
        0%, 80%, 100% { opacity: 0.25; }
        40% { opacity: 1; }
      }
      .suggests {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin: 14px 0;
      }
      .chat-input {
        display: flex;
        gap: 10px;
      }
      .chat-input input {
        flex: 1;
      }
    `,
  ],
})
export class ChatComponent implements AfterViewChecked {
  private ai = inject(AiChatService);
  private state = inject(TestStateService);

  @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

  texto = '';
  cargando = signal(false);
  mensajes = signal<ChatMessage[]>([]);
  private history: ChatMessage[] = [];
  private shouldScroll = false;

  sugerencias = [
    '¿Por qué encajo con esta carrera?',
    '¿Qué materias veré?',
    '¿Cómo me inscribo?',
    '¿Hay becas disponibles?',
  ];

  constructor() {
    const w = this.state.winner();
    const nombre = this.state.primerNombre();
    const saludo = w
      ? `¡Hola${nombre ? ' ' + nombre : ''}! 👋 Soy tu asesor de UNIAGRARIA. ` +
        `Vi que tu resultado fue **${PROFILES[w].carrera}**. Cuéntame, ¿qué te gustaría saber sobre este programa, el proceso de inscripción o la vida universitaria?`
      : `¡Hola! 👋 Soy tu asesor académico de UNIAGRARIA. ¿En qué puedo ayudarte?`;
    this.mensajes.set([{ role: 'assistant', content: saludo }]);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.scroller) {
      this.scroller.nativeElement.scrollTop = this.scroller.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  private get contexto(): ChatContext {
    const w = this.state.winner();
    const p = w ? PROFILES[w] : null;
    return {
      carrera: p?.carrera,
      area: p?.area,
      perfil: p?.perfil,
      nombre: this.state.primerNombre() || undefined,
    };
  }

  enviar(texto: string): void {
    const t = texto.trim();
    if (!t || this.cargando()) return;
    this.texto = '';

    const userMsg: ChatMessage = { role: 'user', content: t };
    this.history.push(userMsg);
    this.mensajes.update((m) => [...m, userMsg]);
    this.cargando.set(true);
    this.shouldScroll = true;

    this.ai.send(this.history, this.contexto).subscribe((reply) => {
      const botMsg: ChatMessage = { role: 'assistant', content: reply };
      this.history.push(botMsg);
      this.mensajes.update((m) => [...m, botMsg]);
      this.cargando.set(false);
      this.shouldScroll = true;
    });
  }

  /** Formato mínimo: **negrita**, saltos de línea y enlaces markdown. */
  formato(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
  }
}
