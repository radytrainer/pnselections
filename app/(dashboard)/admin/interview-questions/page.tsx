"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import {
  listAllInterviewCategoriesForAdmin,
  createCategory,
  updateCategory,
  reorderCategories,
  createQuestion,
  updateQuestion,
  toggleQuestionActive,
  softDeleteQuestion,
  reorderQuestions,
  type InterviewCategoryWithQuestions,
  type InterviewQuestion,
} from "@/services/interviewQuestionService";
import { InterviewQuestionForm } from "@/components/forms/InterviewQuestionForm";
import type { InterviewQuestionFormValues } from "@/features/interview/schema";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CategoryDialogState = { mode: "create" } | { mode: "edit"; category: InterviewCategoryWithQuestions };
type QuestionDialogState = { mode: "create"; categoryId?: string } | { mode: "edit"; question: InterviewQuestion };

export default function InterviewQuestionsAdminPage() {
  const { role, loading: roleLoading } = useRole();
  const [categories, setCategories] = useState<InterviewCategoryWithQuestions[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [questionDialog, setQuestionDialog] = useState<QuestionDialogState | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<InterviewQuestion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return listAllInterviewCategoriesForAdmin()
      .then(setCategories)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load interview questions"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveCategory() {
    if (!categoryDialog || !categoryName.trim()) return;
    setSavingCategory(true);
    try {
      if (categoryDialog.mode === "edit") {
        await updateCategory(categoryDialog.category.id, categoryName.trim());
        toast.success("Category updated");
      } else {
        await createCategory(categoryName.trim());
        toast.success("Category created");
      }
      setCategoryDialog(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save category");
    } finally {
      setSavingCategory(false);
    }
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    try {
      await reorderCategories(reordered.map((c) => c.id));
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder categories");
    }
  }

  async function moveQuestion(category: InterviewCategoryWithQuestions, index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= category.questions.length) return;
    const reordered = [...category.questions];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    try {
      await reorderQuestions(reordered.map((q) => q.id));
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder questions");
    }
  }

  async function handleToggleActive(question: InterviewQuestion, isActive: boolean) {
    try {
      await toggleQuestionActive(question.id, isActive);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update question");
    }
  }

  async function handleSaveQuestion(values: InterviewQuestionFormValues) {
    if (questionDialog?.mode === "edit") {
      await updateQuestion(questionDialog.question.id, { textEn: values.textEn, textKm: values.textKm });
      toast.success("Question updated");
    } else {
      await createQuestion({ categoryId: values.categoryId, textEn: values.textEn, textKm: values.textKm });
      toast.success("Question created");
    }
    setQuestionDialog(null);
    load();
  }

  async function handleDeleteQuestion() {
    if (!deletingQuestion) return;
    setIsDeleting(true);
    try {
      await softDeleteQuestion(deletingQuestion.id);
      toast.success("Question deleted");
      setDeletingQuestion(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete question");
    } finally {
      setIsDeleting(false);
    }
  }

  if (roleLoading || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!can(role, "manageInterviewQuestions")) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Interview Questions</h1>
          <p className="text-sm text-muted-foreground">
            Manage the self-assessment categories and questions students answer at the interview stage.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCategoryName("");
            setCategoryDialog({ mode: "create" });
          }}
        >
          <Plus className="size-4" />
          New Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        categories.map((category, catIdx) => (
          <Card key={category.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {category.name}
                  <Badge variant="outline">{category.questions.length} questions</Badge>
                </CardTitle>
                <CardDescription>Displayed to students in this order.</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" disabled={catIdx === 0} onClick={() => moveCategory(catIdx, -1)}>
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={catIdx === categories.length - 1}
                  onClick={() => moveCategory(catIdx, 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setCategoryName(category.name);
                    setCategoryDialog({ mode: "edit", category });
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button size="sm" onClick={() => setQuestionDialog({ mode: "create", categoryId: category.id })}>
                  <Plus className="size-4" />
                  Add Question
                </Button>
              </div>
            </CardHeader>
            <CardContent className="divide-y">
              {category.questions.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">No questions in this category yet.</p>
              ) : (
                category.questions.map((question, qIdx) => (
                  <div key={question.id} className="flex items-start justify-between gap-3 py-3">
                    <div className={cn("min-w-0 space-y-0.5", !question.is_active && "opacity-50")}>
                      {question.text_km && (
                        <p className="text-sm leading-snug" style={{ fontFamily: "var(--font-battambang)" }}>
                          {question.text_km}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground leading-snug">{question.text_en}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Switch
                        checked={question.is_active}
                        onCheckedChange={(checked) => handleToggleActive(question, checked)}
                        aria-label={question.is_active ? "Deactivate question" : "Activate question"}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={qIdx === 0}
                        onClick={() => moveQuestion(category, qIdx, -1)}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={qIdx === category.questions.length - 1}
                        onClick={() => moveQuestion(category, qIdx, 1)}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setQuestionDialog({ mode: "edit", question })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeletingQuestion(question)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={categoryDialog !== null} onOpenChange={(open) => !open && setCategoryDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{categoryDialog?.mode === "edit" ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <Input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="e.g. Motivation in IT"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(null)} disabled={savingCategory}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={savingCategory || !categoryName.trim()}>
              {savingCategory ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={questionDialog !== null} onOpenChange={(open) => !open && setQuestionDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{questionDialog?.mode === "edit" ? "Edit Question" : "New Question"}</DialogTitle>
          </DialogHeader>
          {questionDialog && (
            <InterviewQuestionForm
              categories={categories}
              defaultValues={
                questionDialog.mode === "edit"
                  ? {
                      categoryId: questionDialog.question.category_id,
                      textEn: questionDialog.question.text_en,
                      textKm: questionDialog.question.text_km ?? "",
                    }
                  : { categoryId: questionDialog.categoryId ?? "" }
              }
              onSubmit={handleSaveQuestion}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deletingQuestion !== null} onOpenChange={(open) => !open && setDeletingQuestion(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Question</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingQuestion?.text_en}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingQuestion(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteQuestion} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
