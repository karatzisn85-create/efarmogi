import React, { useMemo } from 'react';
import styled from 'styled-components';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const StatisticsContainer = styled.div`
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px);
  border-radius: 18px;
  padding: 1.5rem 1.75rem;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.04), 0 1px 0 rgba(255, 255, 255, 0.9) inset;
  border: 1px solid rgba(226, 232, 240, 0.55);
  width: 100%;
  margin-bottom: 1.25rem;
`;

const StatsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
`;

const StatisticsTitle = styled.h2`
  color: #1e293b;
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-align: left;
  position: relative;
  padding-left: 14px;
  text-transform: uppercase;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 80%;
    background: linear-gradient(180deg, #6366f1, #8b5cf6);
    border-radius: 4px;
  }
`;

const StatsDivider = styled.div`
  height: 1px;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1), transparent);
  margin-bottom: 1.25rem;
`;

const SummaryStats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
`;

const StatCard = styled.div`
  background: ${props => props.bg || 'linear-gradient(135deg, #6366f1, #4f46e5)'};
  border-radius: 14px;
  padding: 1.1rem 1.4rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: ${props => props.shadow || '0 4px 16px rgba(99, 102, 241, 0.25)'};
  border: 1px solid rgba(255, 255, 255, 0.12);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 50%);
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    top: -40%;
    right: -20%;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: ${props => props.shadowHover || '0 8px 28px rgba(99, 102, 241, 0.35)'};
  }
`;

const StatCardIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.15);
`;

const StatCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  z-index: 1;
`;

const StatNumber = styled.div`
  font-size: 1.75rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1;
  letter-spacing: -0.5px;
`;

const StatLabel = styled.div`
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ChartContainer = styled.div`
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(6px);
  border-radius: 14px;
  padding: 1.1rem 1.25rem;
  border: 1px solid rgba(226, 232, 240, 0.55);
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.07);
    border-color: rgba(165, 180, 252, 0.35);
  }
`;

const ChartTitle = styled.h3`
  color: #475569;
  margin: 0 0 0.85rem 0;
  font-size: 0.78rem;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  padding-bottom: 0.55rem;
`;

const ChartWrapper = styled.div`
  height: 230px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const NoDataMessage = styled.div`
  text-align: center;
  color: #94a3b8;
  font-style: italic;
  font-size: 0.85rem;
  padding: 1.5rem;
`;

function Statistics({ projects }) {
  const statistics = useMemo(() => {
    if (!projects || projects.length === 0) {
      return {
        totalProjects: 0,
        totalFunding: 0,
        projectTypes: {},
        fundingSources: {},
        projectStatuses: {},
        uniqueProjects: 0
      };
    }

    // Calculate basic statistics
    const totalProjects = projects.length;
    
    // Calculate unique project titles
    const uniqueProjectTitles = new Set(projects.map(p => p.projectTitle));
    const uniqueProjects = uniqueProjectTitles.size;

    // Calculate total funding for all passed projects
    const totalFunding = projects.reduce((sum, project) => {
      const amount = parseFloat(project.approvedAmount?.replace(/\./g, '').replace(',', '.')) || 0;
      return sum + amount;
    }, 0);

    // Count project types
    const projectTypes = projects.reduce((acc, project) => {
      const type = project.projectType || 'Άγνωστο';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Count funding sources with funding amounts
    const fundingSources = projects.reduce((acc, project) => {
      const source = project.fundingSource || 'Άγνωστο';
      const amount = parseFloat(project.approvedAmount?.replace(/\./g, '').replace(',', '.')) || 0;
      
      if (!acc[source]) {
        acc[source] = { count: 0, amount: 0 };
      }
      acc[source].count += 1;
      acc[source].amount += amount;
      return acc;
    }, {});

    // Count project statuses
    const projectStatuses = projects.reduce((acc, project) => {
      const status = project.projectStatus || 'Άγνωστο';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalProjects,
      totalFunding,
      projectTypes,
      fundingSources,
      projectStatuses,
      uniqueProjects
    };
  }, [projects]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Professional chart colors
  const chartColors = [
    '#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899',
    '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
  ];

  // Project Types Chart Data
  const projectTypesData = {
    labels: Object.keys(statistics.projectTypes),
    datasets: [{
      data: Object.values(statistics.projectTypes),
      backgroundColor: chartColors.slice(0, Object.keys(statistics.projectTypes).length),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  // Funding Sources Chart Data
  const fundingSourcesData = {
    labels: Object.keys(statistics.fundingSources).map(source => {
      return source.length > 20 ? source.substring(0, 17) + '...' : source;
    }),
    datasets: [{
      label: 'Χρηματοδότηση (€)',
      data: Object.values(statistics.fundingSources).map(item => item.amount),
      backgroundColor: 'rgba(99, 102, 241, 0.75)',
      borderColor: '#6366f1',
      borderWidth: 1,
      borderRadius: 6,
    }]
  };

  // Project Statuses Chart Data
  const projectStatusesData = {
    labels: Object.keys(statistics.projectStatuses),
    datasets: [{
      data: Object.values(statistics.projectStatuses),
      backgroundColor: chartColors.slice(0, Object.keys(statistics.projectStatuses).length),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 10,
          boxWidth: 10,
          boxHeight: 10,
          font: { size: 10, weight: '600' },
          color: '#475569'
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: { size: 11, weight: '700' },
        bodyFont: { size: 11 }
      }
    }
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 }, color: '#64748b' }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(226, 232, 240, 0.6)', drawBorder: false },
        ticks: {
          font: { size: 9 },
          color: '#64748b',
          callback: function(value) {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M€';
            if (value >= 1000) return (value / 1000).toFixed(0) + 'K€';
            return value + '€';
          }
        }
      }
    },
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
          }
        }
      }
    }
  };

  if (projects.length === 0) {
    return (
      <StatisticsContainer>
        <StatsHeader>
          <StatisticsTitle>Στατιστικά Στοιχεία</StatisticsTitle>
        </StatsHeader>
        <NoDataMessage>Δεν υπάρχουν δεδομένα για την εμφάνιση στατιστικών</NoDataMessage>
      </StatisticsContainer>
    );
  }

  return (
    <StatisticsContainer>
      <StatsHeader>
        <StatisticsTitle>Στατιστικά Στοιχεία</StatisticsTitle>
      </StatsHeader>
      <StatsDivider />

      <SummaryStats>
        <StatCard
          bg="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          shadow="0 4px 18px rgba(16, 185, 129, 0.28)"
          shadowHover="0 8px 28px rgba(16, 185, 129, 0.42)"
        >
          <StatCardIcon>🏗️</StatCardIcon>
          <StatCardBody>
            <StatNumber>{statistics.uniqueProjects}</StatNumber>
            <StatLabel>Συνολικά Έργα</StatLabel>
          </StatCardBody>
        </StatCard>

        <StatCard
          bg="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          shadow="0 4px 18px rgba(59, 130, 246, 0.28)"
          shadowHover="0 8px 28px rgba(59, 130, 246, 0.42)"
        >
          <StatCardIcon>📋</StatCardIcon>
          <StatCardBody>
            <StatNumber>{statistics.totalProjects}</StatNumber>
            <StatLabel>Συνολικά Υποέργα</StatLabel>
          </StatCardBody>
        </StatCard>

        <StatCard
          bg="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          shadow="0 4px 18px rgba(245, 158, 11, 0.28)"
          shadowHover="0 8px 28px rgba(245, 158, 11, 0.42)"
        >
          <StatCardIcon>💰</StatCardIcon>
          <StatCardBody>
            <StatNumber style={{ fontSize: '1.3rem' }}>{formatCurrency(statistics.totalFunding)}</StatNumber>
            <StatLabel>Συνολική Χρηματοδότηση</StatLabel>
          </StatCardBody>
        </StatCard>
      </SummaryStats>

      <ChartsGrid>
        <ChartContainer>
          <ChartTitle>Είδη Υποέργων</ChartTitle>
          <ChartWrapper>
            {Object.keys(statistics.projectTypes).length > 0 ? (
              <Pie data={projectTypesData} options={chartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>Χρηματοδότηση ανά Πηγή</ChartTitle>
          <ChartWrapper>
            {Object.keys(statistics.fundingSources).length > 0 ? (
              <Bar data={fundingSourcesData} options={barChartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>Κατάσταση Υποέργων</ChartTitle>
          <ChartWrapper>
            {Object.keys(statistics.projectStatuses).length > 0 ? (
              <Pie data={projectStatusesData} options={chartOptions} />
            ) : (
              <NoDataMessage>Δεν υπάρχουν δεδομένα</NoDataMessage>
            )}
          </ChartWrapper>
        </ChartContainer>
      </ChartsGrid>
    </StatisticsContainer>
  );
}

export default Statistics;
