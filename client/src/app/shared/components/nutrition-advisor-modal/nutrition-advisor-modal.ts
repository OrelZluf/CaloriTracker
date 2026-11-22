import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
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
export class NutritionAdvisorModal {
  private readonly advisorService = inject(AdvisorService);
  private readonly mealsService = inject(MealsService);

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

  readonly quickPrompts: string[] = [
    'מה כדאי לי לאכול לארוחת ערב כדי להשלים חלבון?',
    'בא לי משהו קליל ומשביע שלא יעבור את המכסה',
    'תציע לי נשנוש מתוק ומאוזן להמשך היום',
    'ארוחה צמחונית עשירה בחלבון ופחמימה מורכבת'
  ];

  sendPrompt(promptText?: string): void {
    const text = (promptText ?? this.inputText()).trim();
    if (!text || this.isSending()) return;

    const currentHistory = this.messages().map(m => ({ role: m.role, text: m.text }));
    this.messages.update(list => [...list, { role: 'user', text }]);
    if (!promptText) {
      this.inputText.set('');
    }
    this.isSending.set(true);
    this.loggedNotice.set(null);

    this.advisorService.sendMessage(text, this.dateStr, currentHistory).subscribe({
      next: (res) => {
        this.isSending.set(false);
        if (res?.data) {
          this.messages.update(list => [
            ...list,
            {
              role: 'assistant',
              text: res.data.reply,
              suggestions: res.data.suggestions || []
            }
          ]);
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
