from typing import Dict, Any, List
import logging
from datetime import datetime
import numpy as np
from app.core.config import settings

logger = logging.getLogger(__name__)

class CalculationService:
    def __init__(self):
        self.calculation_types = {
            "credit_card": self._calculate_credit_card_payoff,
            "savings": self._calculate_savings_goal,
            "student_loan": self._calculate_student_loan,
            "investment": self._calculate_investment_growth
        }
    
    async def calculate(self, calculation_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Perform financial calculation with step-by-step explanation"""
        try:
            if calculation_type not in self.calculation_types:
                raise ValueError(f"Unsupported calculation type: {calculation_type}")
            
            # Perform calculation
            result = await self.calculation_types[calculation_type](params)
            
            # Generate step-by-step explanation
            explanation = self._generate_explanation(calculation_type, params, result)
            
            # Generate action plan
            action_plan = self._generate_action_plan(calculation_type, result)
            
            return {
                "result": result,
                "explanation": explanation,
                "action_plan": action_plan,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Calculation failed: {e}")
            raise
    
    async def _calculate_credit_card_payoff(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate credit card payoff plan"""
        try:
            balance = float(params['balance'])
            apr = float(params['apr']) / 100  # Convert to decimal
            monthly_payment = float(params['monthly_payment'])
            
            # Calculate months to payoff
            monthly_rate = apr / 12
            months = -np.log(1 - (balance * monthly_rate / monthly_payment)) / np.log(1 + monthly_rate)
            months = int(np.ceil(months))
            
            # Calculate total interest
            total_payments = months * monthly_payment
            total_interest = total_payments - balance
            
            # Generate monthly breakdown
            monthly_breakdown = []
            remaining_balance = balance
            
            for month in range(1, months + 1):
                interest_payment = remaining_balance * monthly_rate
                principal_payment = monthly_payment - interest_payment
                remaining_balance -= principal_payment
                
                monthly_breakdown.append({
                    "month": month,
                    "payment": monthly_payment,
                    "interest": interest_payment,
                    "principal": principal_payment,
                    "remaining_balance": max(0, remaining_balance)
                })
            
            return {
                "months_to_payoff": months,
                "total_interest": total_interest,
                "total_payments": total_payments,
                "monthly_breakdown": monthly_breakdown
            }
            
        except Exception as e:
            logger.error(f"Credit card calculation failed: {e}")
            raise
    
    async def _calculate_savings_goal(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate savings goal projection"""
        try:
            current_savings = float(params['current_savings'])
            target_amount = float(params['target_amount'])
            monthly_contribution = float(params['monthly_contribution'])
            annual_return = float(params['annual_return']) / 100  # Convert to decimal
            
            # Calculate months to reach goal
            monthly_return = annual_return / 12
            months = 0
            current_amount = current_savings
            
            monthly_breakdown = []
            
            while current_amount < target_amount and months < 360:  # 30 years max
                months += 1
                current_amount = (current_amount + monthly_contribution) * (1 + monthly_return)
                
                monthly_breakdown.append({
                    "month": months,
                    "contribution": monthly_contribution,
                    "interest_earned": current_amount - (current_savings + (monthly_contribution * months)),
                    "total_amount": current_amount
                })
            
            return {
                "months_to_goal": months,
                "final_amount": current_amount,
                "total_contributions": current_savings + (monthly_contribution * months),
                "total_interest": current_amount - (current_savings + (monthly_contribution * months)),
                "monthly_breakdown": monthly_breakdown
            }
            
        except Exception as e:
            logger.error(f"Savings goal calculation failed: {e}")
            raise
    
    async def _calculate_student_loan(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate student loan amortization"""
        try:
            loan_amount = float(params['loan_amount'])
            interest_rate = float(params['interest_rate']) / 100  # Convert to decimal
            loan_term = int(params['loan_term'])  # in years
            payment_frequency = params.get('payment_frequency', 'monthly')
            
            # Convert to monthly
            if payment_frequency == 'monthly':
                periods = loan_term * 12
                period_rate = interest_rate / 12
            else:
                periods = loan_term * 52
                period_rate = interest_rate / 52
            
            # Calculate payment
            payment = loan_amount * (period_rate * (1 + period_rate)**periods) / ((1 + period_rate)**periods - 1)
            
            # Generate amortization schedule
            schedule = []
            remaining_balance = loan_amount
            
            for period in range(1, periods + 1):
                interest_payment = remaining_balance * period_rate
                principal_payment = payment - interest_payment
                remaining_balance -= principal_payment
                
                schedule.append({
                    "period": period,
                    "payment": payment,
                    "interest": interest_payment,
                    "principal": principal_payment,
                    "remaining_balance": max(0, remaining_balance)
                })
            
            return {
                "payment_amount": payment,
                "total_payments": payment * periods,
                "total_interest": (payment * periods) - loan_amount,
                "amortization_schedule": schedule
            }
            
        except Exception as e:
            logger.error(f"Student loan calculation failed: {e}")
            raise
    
    async def _calculate_investment_growth(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate investment growth projection"""
        try:
            initial_investment = float(params['initial_investment'])
            monthly_contribution = float(params['monthly_contribution'])
            annual_return = float(params['annual_return']) / 100  # Convert to decimal
            years = int(params['years'])
            
            monthly_return = annual_return / 12
            months = years * 12
            
            # Calculate growth
            monthly_breakdown = []
            current_amount = initial_investment
            
            for month in range(1, months + 1):
                current_amount = (current_amount + monthly_contribution) * (1 + monthly_return)
                
                monthly_breakdown.append({
                    "month": month,
                    "contribution": monthly_contribution,
                    "interest_earned": current_amount - (initial_investment + (monthly_contribution * month)),
                    "total_amount": current_amount
                })
            
            return {
                "final_amount": current_amount,
                "total_contributions": initial_investment + (monthly_contribution * months),
                "total_interest": current_amount - (initial_investment + (monthly_contribution * months)),
                "monthly_breakdown": monthly_breakdown
            }
            
        except Exception as e:
            logger.error(f"Investment growth calculation failed: {e}")
            raise
    
    def _generate_explanation(self, calculation_type: str, params: Dict[str, Any], 
                            result: Dict[str, Any]) -> List[str]:
        """Generate step-by-step explanation of the calculation"""
        explanations = []
        
        if calculation_type == "credit_card":
            explanations = [
                f"Starting with a balance of ${params['balance']:,.2f}",
                f"With an APR of {params['apr']}%, the monthly interest rate is {params['apr']/12:.2f}%",
                f"Making monthly payments of ${params['monthly_payment']:,.2f}",
                f"It will take {result['months_to_payoff']} months to pay off the debt",
                f"Total interest paid will be ${result['total_interest']:,.2f}",
                f"Total payments will be ${result['total_payments']:,.2f}"
            ]
            
        elif calculation_type == "savings":
            explanations = [
                f"Starting with ${params['current_savings']:,.2f} in savings",
                f"Contributing ${params['monthly_contribution']:,.2f} monthly",
                f"With an annual return of {params['annual_return']}%",
                f"It will take {result['months_to_goal']} months to reach ${params['target_amount']:,.2f}",
                f"Total contributions will be ${result['total_contributions']:,.2f}",
                f"Total interest earned will be ${result['total_interest']:,.2f}"
            ]
            
        elif calculation_type == "student_loan":
            explanations = [
                f"Loan amount: ${params['loan_amount']:,.2f}",
                f"Interest rate: {params['interest_rate']}%",
                f"Loan term: {params['loan_term']} years",
                f"Monthly payment: ${result['payment_amount']:,.2f}",
                f"Total payments: ${result['total_payments']:,.2f}",
                f"Total interest: ${result['total_interest']:,.2f}"
            ]
            
        elif calculation_type == "investment":
            explanations = [
                f"Initial investment: ${params['initial_investment']:,.2f}",
                f"Monthly contribution: ${params['monthly_contribution']:,.2f}",
                f"Annual return: {params['annual_return']}%",
                f"Investment period: {params['years']} years",
                f"Final amount: ${result['final_amount']:,.2f}",
                f"Total contributions: ${result['total_contributions']:,.2f}",
                f"Total interest earned: ${result['total_interest']:,.2f}"
            ]
        
        return explanations
    
    def _generate_action_plan(self, calculation_type: str, result: Dict[str, Any]) -> List[str]:
        """Generate actionable steps based on calculation results"""
        action_plan = []
        
        if calculation_type == "credit_card":
            action_plan = [
                f"Make monthly payments of ${result['payment_amount']:,.2f}",
                "Set up automatic payments to avoid late fees",
                "Consider balance transfer if you can get a lower APR",
                "Avoid new charges while paying off the debt",
                "Build an emergency fund to prevent future credit card debt"
            ]
            
        elif calculation_type == "savings":
            action_plan = [
                f"Set up automatic monthly contributions of ${result['monthly_contribution']:,.2f}",
                "Consider increasing contributions if possible",
                "Look for high-yield savings accounts",
                "Review and adjust your budget to maintain savings rate",
                "Set up separate accounts for different savings goals"
            ]
            
        elif calculation_type == "student_loan":
            action_plan = [
                f"Make {result['payment_frequency']} payments of ${result['payment_amount']:,.2f}",
                "Set up automatic payments to avoid late fees",
                "Consider refinancing if you can get a lower interest rate",
                "Look into income-driven repayment plans if eligible",
                "Make extra payments when possible to reduce total interest"
            ]
            
        elif calculation_type == "investment":
            action_plan = [
                f"Set up automatic monthly investments of ${result['monthly_contribution']:,.2f}",
                "Diversify your investments across different asset classes",
                "Regularly rebalance your portfolio",
                "Consider tax-advantaged accounts (401k, IRA)",
                "Review and adjust your investment strategy annually"
            ]
        
        return action_plan 