"""Crop calendar tasks and expense/income/harvest records."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from ..core.deps import CurrentUser, DbSession
from ..models.tasks import Expense, FarmTask

router = APIRouter(prefix="/tasks", tags=["tasks"])
expenses_router = APIRouter(prefix="/expenses", tags=["expenses"])


# ── Task schemas ──────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category: str = "general"
    due_date: str | None = None
    plot_id: int | None = None


class TaskOut(TaskCreate):
    id: int
    owner_id: int
    completed: bool
    model_config = {"from_attributes": True}


# ── Task routes ───────────────────────────────────────────────────────────

@router.get("", response_model=list[TaskOut])
def list_tasks(user: CurrentUser, db: DbSession) -> list[FarmTask]:
    return list(db.scalars(
        select(FarmTask).where(FarmTask.owner_id == user.id)
        .order_by(FarmTask.due_date.asc().nullslast(), FarmTask.created_at.desc())
    ).all())


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, user: CurrentUser, db: DbSession) -> FarmTask:
    task = FarmTask(owner_id=user.id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/complete", response_model=TaskOut)
def complete_task(task_id: int, user: CurrentUser, db: DbSession) -> FarmTask:
    task = db.get(FarmTask, task_id)
    if not task or task.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Task not found.")
    task.completed = True
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, user: CurrentUser, db: DbSession) -> None:
    task = db.get(FarmTask, task_id)
    if not task or task.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Task not found.")
    db.delete(task)
    db.commit()


# ── Expense schemas ───────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    kind: str = Field(pattern="^(expense|income|harvest)$")
    category: str = "general"
    amount: float = Field(ge=0)
    currency: str = "INR"
    note: str | None = None
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    plot_id: int | None = None


class ExpenseOut(ExpenseCreate):
    id: int
    owner_id: int
    model_config = {"from_attributes": True}


class ProfitSummary(BaseModel):
    total_income: float
    total_expense: float
    net: float
    currency: str = "INR"


# ── Expense routes ────────────────────────────────────────────────────────

@expenses_router.get("", response_model=list[ExpenseOut])
def list_expenses(user: CurrentUser, db: DbSession) -> list[Expense]:
    return list(db.scalars(
        select(Expense).where(Expense.owner_id == user.id)
        .order_by(Expense.date.desc())
        .limit(200)
    ).all())


@expenses_router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(payload: ExpenseCreate, user: CurrentUser, db: DbSession) -> Expense:
    expense = Expense(owner_id=user.id, **payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@expenses_router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, user: CurrentUser, db: DbSession) -> None:
    exp = db.get(Expense, expense_id)
    if not exp or exp.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Expense not found.")
    db.delete(exp)
    db.commit()


@expenses_router.get("/summary", response_model=ProfitSummary)
def get_summary(user: CurrentUser, db: DbSession) -> ProfitSummary:
    records = db.scalars(select(Expense).where(Expense.owner_id == user.id)).all()
    income = sum(r.amount for r in records if r.kind == "income")
    expense = sum(r.amount for r in records if r.kind == "expense")
    return ProfitSummary(total_income=income, total_expense=expense, net=income - expense)
