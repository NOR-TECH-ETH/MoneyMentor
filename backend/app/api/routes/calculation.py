from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

from app.models.schemas import CalculationRequest, CalculationResult
from app.agents.crew import money_mentor_crew
from app.services.calculation_service import CalculationService

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/debt-payoff", response_model=CalculationResult)
async def calculate_debt_payoff(request: CalculationRequest):
    """Calculate debt payoff scenarios using CrewAI calculation agent"""
    try:
        # Create calculation crew
        calc_crew = money_mentor_crew.create_calculation_crew({
            "calculation_type": "debt_payoff",
            "principal": request.principal,
            "interest_rate": request.interest_rate,
            "monthly_payment": request.monthly_payment,
            "target_months": request.target_months
        })
        
        # Execute the crew
        result = calc_crew.kickoff()
        
        # Parse and return result
        return CalculationResult(**result)
        
    except Exception as e:
        logger.error(f"Debt payoff calculation failed: {e}")
        raise HTTPException(status_code=500, detail="Debt payoff calculation failed")

@router.post("/savings-goal", response_model=CalculationResult)
async def calculate_savings_goal(request: CalculationRequest):
    """Calculate savings goal requirements"""
    try:
        # Create calculation crew
        calc_crew = money_mentor_crew.create_calculation_crew({
            "calculation_type": "savings_goal",
            "target_amount": request.target_amount,
            "interest_rate": request.interest_rate,
            "target_months": request.target_months
        })
        
        # Execute the crew
        result = calc_crew.kickoff()
        
        return CalculationResult(**result)
        
    except Exception as e:
        logger.error(f"Savings goal calculation failed: {e}")
        raise HTTPException(status_code=500, detail="Savings goal calculation failed")

@router.post("/loan-amortization", response_model=CalculationResult)
async def calculate_loan_amortization(request: CalculationRequest):
    """Calculate loan amortization schedule"""
    try:
        # Create calculation crew
        calc_crew = money_mentor_crew.create_calculation_crew({
            "calculation_type": "loan_amortization",
            "principal": request.principal,
            "interest_rate": request.interest_rate,
            "monthly_payment": request.monthly_payment
        })
        
        # Execute the crew
        result = calc_crew.kickoff()
        
        return CalculationResult(**result)
        
    except Exception as e:
        logger.error(f"Loan amortization calculation failed: {e}")
        raise HTTPException(status_code=500, detail="Loan amortization calculation failed")

@router.post("/custom")
async def custom_calculation(calculation_data: Dict[str, Any]):
    """Perform custom financial calculations"""
    try:
        # Create calculation crew with custom parameters
        calc_crew = money_mentor_crew.create_calculation_crew(calculation_data)
        
        # Execute the crew
        result = calc_crew.kickoff()
        
        return {
            "success": True,
            "result": result,
            "disclaimer": "These are estimates only. Please consult with a certified financial professional for personalized advice."
        }
        
    except Exception as e:
        logger.error(f"Custom calculation failed: {e}")
        raise HTTPException(status_code=500, detail="Custom calculation failed") 