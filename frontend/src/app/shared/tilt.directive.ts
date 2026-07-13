import {
  Directive, ElementRef, HostListener, Input,
} from '@angular/core';

/**
 * Inclinación 3D interactiva: el elemento rota siguiendo el cursor con
 * perspectiva, dando sensación de profundidad. Uso: <div appTilt>…</div>
 */
@Directive({
  selector: '[appTilt]',
  standalone: true,
})
export class TiltDirective {
  /** Grados máximos de inclinación. */
  @Input() tiltMax = 12;
  /** Escala al pasar el cursor. */
  @Input() tiltScale = 1.04;
  /** Brillo especular que sigue al cursor. */
  @Input() tiltGlare = true;

  private el: HTMLElement;
  private raf = 0;

  constructor(ref: ElementRef<HTMLElement>) {
    this.el = ref.nativeElement;
    const style = this.el.style;
    style.transition = 'transform 0.3s cubic-bezier(0.22,1,0.36,1)';
    style.transformStyle = 'preserve-3d';
    style.willChange = 'transform';
  }

  @HostListener('mousemove', ['$event'])
  onMove(e: MouseEvent): void {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      const r = this.el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * this.tiltMax * 2;
      const ry = (px - 0.5) * this.tiltMax * 2;
      this.el.style.transition = 'transform 0.08s linear';
      this.el.style.transform =
        `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${this.tiltScale})`;
      if (this.tiltGlare) {
        this.el.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`);
        this.el.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`);
        this.el.style.setProperty('--glare-o', '1');
      }
    });
  }

  @HostListener('mouseleave')
  onLeave(): void {
    cancelAnimationFrame(this.raf);
    this.el.style.transition = 'transform 0.5s cubic-bezier(0.22,1,0.36,1)';
    this.el.style.transform = 'perspective(900px) rotateX(0) rotateY(0) scale(1)';
    this.el.style.setProperty('--glare-o', '0');
  }
}
