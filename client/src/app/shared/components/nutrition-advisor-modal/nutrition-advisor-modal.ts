import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdvisorService, AdvisorChatTurn, AdvisorMealSuggestion } from '../../../core/services/advisor.service';
import { MealsService } from '../../../core/services/meals.service';

@Component({
  selector: 'app-nutrition-advisor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nutrition-advisor-modal.html',
  styleUrl: './nutrition-advisor-modal.css'
})
export class NutritionAdvisorModal implements OnChanges, OnDestroy {
  private readonly advisorService = inject(AdvisorService);
  private readonly mealsService = inject(MealsService);

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

  @Input() isOpen = false;
  @Input() dateStr = '';
  @Input() dateLabel = 'היום';
  @Input() remainingCalories = 0;
  @Input() remainingProtein = 0;
  @Input() remainingCarbs = 0;
  @Input() remainingFat = 0;

  @Output() close = new EventEmitter<void>();
  @Output() mealAdded = new EventEmitter<void>();

  readonly messages = signal<AdvisorChatTurn[]>([]);
  readonly inputText = signal<string>('');
  readonly isSending = signal<boolean>(false);
  readonly loggingSuggestionTitle = signal<string | null>(null);
  readonly loggedNotice = signal<string | null>(null);
  readonly showQuickPrompts = signal<boolean>(true);

  private historyTrapInstalled = false;
  private readonly popStateHandler = () => {
    if (this.isOpen) {
      this.historyTrapInstalled = false;
      this.closeModal(true);
    }
  };

  readonly quickPrompts: { label: string; prompt: string }[] = [
    { label: '🥩 השלמת חלבון לערב', prompt: 'מה כדאי לי לאכול לארוחת ערב כדי להשלים חלבון?' },
    { label: '🥗 ארוחה קלילה ומשביעה', prompt: 'בא לי משהו קליל ומשביע שלא יעבור את המכסה' },
    { label: '🍓 נשנוש מתוק ומאוזן', prompt: 'תציע לי נשנוש מתוק ומאוזן להמשך היום' },
    { label: '🌱 ארוחה צמחונית מאוזנת', prompt: 'ארוחה צמחונית עשירה בחלבון ופחמימה מורכבת' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dateStr'] && this.dateStr) {
      const cachedTurns = this.advisorService.getCachedChatHistory(this.dateStr);
      this.messages.set(cachedTurns);
      this.showQuickPrompts.set(cachedTurns.length === 0);
    }
    if (changes['isOpen']) {
      if (this.isOpen) {
        const cachedTurns = this.advisorService.getCachedChatHistory(this.dateStr);
        if (cachedTurns.length > 0 && this.messages().length === 0) {
          this.messages.set(cachedTurns);
          this.showQuickPrompts.set(false);
        }
        this.onOpen();
      } else {
        this.onCloseCleanup();
      }
    }
  }

  ngOnDestroy(): void {
    this.onCloseCleanup();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen) {
      this.closeModal();
    }
  }

  private onOpen(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
    if (typeof window !== 'undefined' && !this.historyTrapInstalled) {
      try {
        window.history.pushState({ caloriAdvisorModal: true }, '');
        window.addEventListener('popstate', this.popStateHandler);
        this.historyTrapInstalled = true;
      } catch {
        // Ignore in restricted environments
      }
    }
    this.scrollToBottom();
  }

  private onCloseCleanup(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.popStateHandler);
      if (this.historyTrapInstalled) {
        this.historyTrapInstalled = false;
        try {
          if (window.history.state?.caloriAdvisorModal) {
            window.history.back();
          }
        } catch {
          // Ignore history errors
        }
      }
    }
  }

  closeModal(fromPopState = false): void {
    if (fromPopState) {
      this.historyTrapInstalled = false;
    }
    this.onCloseCleanup();
    this.close.emit();
  }

  togglePrompts(): void {
    this.showQuickPrompts.update(v => !v);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messagesContainer?.nativeElement;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }, 60);
  }

  sendPrompt(promptText?: string): void {
    const text = (promptText ?? this.inputText()).trim();
    if (!text || this.isSending()) return;

    const currentHistory = this.messages().map(m => ({ role: m.role, text: m.text }));
    this.messages.update(list => {
      const next: AdvisorChatTurn[] = [...list, { role: 'user', text }];
      this.advisorService.saveCachedChatHistory(this.dateStr, next);
      return next;
    });
    if (!promptText) {
      this.inputText.set('');
    }
    // Collapse quick prompts once the conversation starts so the user sees maximum chat area on mobile
    this.showQuickPrompts.set(false);
    this.isSending.set(true);
    this.loggedNotice.set(null);
    this.scrollToBottom();

    this.advisorService.sendMessage(text, this.dateStr, currentHistory).subscribe({
      next: (res) => {
        this.isSending.set(false);
        if (res?.data) {
          this.messages.update(list => {
            const next: AdvisorChatTurn[] = [
              ...list,
              {
                role: 'assistant',
                text: res.data.reply,
                suggestions: res.data.suggestions || []
              }
            ];
            this.advisorService.saveCachedChatHistory(this.dateStr, next);
            return next;
          });
          this.scrollToBottom();
        }
      },
      error: () => {
        this.isSending.set(false);
        this.messages.update(list => [
          ...list,
          {
            role: 'assistant',
            text: 'לא הצלחתי להתחבר ליועץ התזונה כרגע. נסה שוב בעוד רגע.'
          }
        ]);
        this.scrollToBottom();
      }
    });
  }

  logSuggestedMeal(s: AdvisorMealSuggestion): void {
    if (this.loggingSuggestionTitle()) return;
    this.loggingSuggestionTitle.set(s.title);
    this.loggedNotice.set(null);

    this.mealsService
      .saveMeal({
        title: s.title,
        meal_type: s.meal_type || 'dinner',
        input_method: 'text',
        raw_input: `המלצת יועץ תזונה: ${s.title}`,
        date: this.dateStr || undefined,
        ingredients: [
          {
            name: s.title,
            category: s.protein_grams >= s.carbs_grams ? 'protein' : 'carb',
            estimated_grams: 250,
            calories: Math.round(s.calories || 0),
            protein_grams: Math.round(s.protein_grams || 0),
            carbs_grams: Math.round(s.carbs_grams || 0),
            fat_grams: Math.round(s.fat_grams || 0),
            fiber_grams: 4,
            sugar_grams: 3
          }
        ]
      })
      .subscribe({
        next: () => {
          this.loggingSuggestionTitle.set(null);
          this.loggedNotice.set(`הארוחה "${s.title}" נוספה ליומן!`);
          this.mealAdded.emit();
          this.scrollToBottom();
        },
        error: () => {
          this.loggingSuggestionTitle.set(null);
        }
      });
  }

  getMealTypeBadge(type: string): string {
    const map: Record<string, string> = {
      breakfast: '🌅 בוקר',
      lunch: '☀️ צהריים',
      dinner: '🌙 ערב',
      snack: '🍎 נשנוש'
    };
    return map[type] || '🍽️ ארוחה';
  }
}
