
import { Component, signal, computed, inject, ElementRef, viewChild, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { GoogleGenAI } from "@google/genai";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  host: {
    '(document:mouseleave)': 'onMouseLeave($event)'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  // --- Configuration ---
  private readonly unlockTimeSeconds = 30; // Time to unlock content
  private readonly initialTimerSeconds = 600; // 10 minutes urgency
  private ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] });
  private destroyRef = inject(DestroyRef);

  // --- State Signals ---
  contentUnlocked = signal(false);
  progressWidth = signal(0);
  timerDisplay = signal('10:00');
  spotsLeft = signal(10);
  
  // --- AI Tool State ---
  analyzerControl = new FormControl('');
  analyzerResult = signal('');
  isAnalyzing = signal(false);

  generatorControl = new FormControl('');
  generatorResult = signal('');
  isGenerating = signal(false);

  // --- UI State ---
  faqOpen = signal<number | null>(null);
  showExitModal = signal(false);
  hasShownExitModal = signal(false);
  
  // FOMO Toast
  showFomo = signal(false);
  fomoUser = signal({ name: 'Carregando...', action: '...' });

  // References
  videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoPlayer');

  constructor() {
    this.startLifecycle();
  }

  startLifecycle() {
    // 1. Urgency Timer
    let timeLeft = this.initialTimerSeconds;
    const timerInterval = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        this.timerDisplay.set(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
      } else {
        clearInterval(timerInterval);
      }
    }, 1000);

    // 2. Video Progress & Unlock
    // We update this via the video timeupdate event, but have a fallback
    const fallbackTimeout = setTimeout(() => {
      if (!this.contentUnlocked()) {
        this.unlockContent();
      }
    }, (this.unlockTimeSeconds + 15) * 1000); // Fallback 45s

    // 3. Scarcity Dropper
    const dropSpots = () => {
      const current = this.spotsLeft();
      if (current > 2) {
        this.spotsLeft.set(current - 1);
        setTimeout(dropSpots, Math.random() * 10000 + 5000);
      }
    };
    setTimeout(dropSpots, 8000);

    // 4. FOMO Toast System
    const users = [
      { name: "Juliana de SP", action: "comprou o Guia" },
      { name: "Beatriz do RJ", action: "garantiu a vaga" },
      { name: "Camila de BH", action: "acessou o dossiê" },
      { name: "Larissa de POA", action: "comprou agora" }
    ];

    const runFomo = () => {
      if (!this.contentUnlocked()) {
        setTimeout(runFomo, 5000);
        return;
      }
      const user = users[Math.floor(Math.random() * users.length)];
      this.fomoUser.set(user);
      this.showFomo.set(true);

      setTimeout(() => {
        this.showFomo.set(false);
      }, 4000);

      setTimeout(runFomo, Math.random() * 15000 + 10000);
    };
    setTimeout(runFomo, 35000);

    // Cleanup using DestroyRef
    this.destroyRef.onDestroy(() => {
      clearInterval(timerInterval);
      clearTimeout(fallbackTimeout);
    });
  }

  // --- Logic ---

  onVideoTimeUpdate() {
    const video = this.videoElement()?.nativeElement;
    if (!video) return;

    if (!this.contentUnlocked()) {
      const percentage = (video.currentTime / this.unlockTimeSeconds) * 100;
      this.progressWidth.set(Math.min(percentage, 100));

      if (video.currentTime >= this.unlockTimeSeconds) {
        this.unlockContent();
      }
    }
  }

  unlockContent() {
    if (this.contentUnlocked()) return;
    this.progressWidth.set(100);
    this.contentUnlocked.set(true);
  }

  // --- AI Functions ---

  async analyzeMessage() {
    const text = this.analyzerControl.value;
    if (!text?.trim()) return;

    this.isAnalyzing.set(true);
    this.analyzerResult.set('');

    try {
      const systemInstruction = "Você é um especialista em psicologia forense, focado em detectar abuso narcisista. Analise a mensagem do usuário. 1. Identifique táticas (Gaslighting, Vitimização, etc). 2. Dê um 'Nível de Toxicidade' de 1 a 10. 3. Explique o subtexto. Seja direto e clínico. Responda em texto simples, sem markdown complexo.";
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: text,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7
        }
      });

      this.analyzerResult.set(response.text || 'Não foi possível analisar. Tente novamente.');
    } catch (e) {
      console.error(e);
      this.analyzerResult.set('Erro ao conectar com o laboratório neural.');
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  async generateGreyRock() {
    const text = this.generatorControl.value;
    if (!text?.trim()) return;

    this.isGenerating.set(true);
    this.generatorResult.set('');

    try {
      const systemInstruction = "Você é um treinador do método 'Pedra Cinza' (Grey Rock). O usuário enviará uma provocação. Gere 3 opções de respostas curtas, não-reativas e entediantes. Formate como lista simples.";
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: text,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7
        }
      });

      this.generatorResult.set(response.text || 'Não foi possível gerar a defesa.');
    } catch (e) {
      console.error(e);
      this.generatorResult.set('Erro ao conectar com o laboratório neural.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  // --- Interactions ---

  toggleFaq(index: number) {
    if (this.faqOpen() === index) {
      this.faqOpen.set(null);
    } else {
      this.faqOpen.set(index);
    }
  }

  onMouseLeave(event: MouseEvent) {
    if (event.clientY < 0 && !this.hasShownExitModal() && this.contentUnlocked()) {
      this.showExitModal.set(true);
      this.hasShownExitModal.set(true);
    }
  }

  closeExitModal() {
    this.showExitModal.set(false);
  }

  scrollToCheckout() {
    window.open('https://example.com', '_blank');
  }

  // Data
  faqs = [
    { 
      q: 'O acesso é anônimo?', 
      a: 'Sim. A fatura do cartão virá com um nome genérico ("PAYT" ou "HOTM") e o material é digital, enviado diretamente para o seu e-mail.' 
    },
    { 
      q: 'Serve para homens ou mulheres?', 
      a: 'O padrão predatório é comportamental e humano, independente de gênero. O guia serve para identificar manipulação em qualquer relacionamento.' 
    },
    { 
      q: 'Como recebo o acesso?', 
      a: 'Imediatamente após a confirmação do pagamento, você recebe um e-mail com o link para baixar o Dossiê e os áudios complementares.' 
    }
  ];
}
