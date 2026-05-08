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
  background: white;
  border-radius: 15px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  width: 100%;
  margin-bottom: 2rem;
`;

const StatisticsTitle = styled.h2`
  color: #1a237e;
  margin-bottom: 2.5rem;
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  text-align: center;
  position: relative;
  padding-bottom: 1rem;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 4px;
    background: linear-gradient(90deg, transparent, #ffd700, transparent);
    border-radius: 2px;
  }
  
  box-shadow: 0 2px 8px rgba(26, 35, 126, 0.1);
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 2rem;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ChartContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid #e9ecef;
`;

const ChartTitle = styled.h3`
  color: #495057;
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  text-align: center;
  border-bottom: 2px solid #f8f9fa;
  padding-bottom: 0.5rem;
`;

const ChartWrapper = styled.div`
  height: 300px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const NoDataMessage = styled.div`
  text-align: center;
  color: #6c757d;
  font-style: italic;
  padding: 2rem;
`;

const SummaryStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const StatCard = styled.div`
  background: linear-gradient(135deg, ${props => props.color || '#6c757d'} 0%, ${props => props.darkColor || '#5a6268'} 100%);
  color: white;
  padding: 1.2rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.3);
  }
  
  .stat-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
    
    .stat-icon {
      font-size: 1.2rem;
      opacity: 0.9;
    }
    
    .stat-title {
      font-size: 0.85rem;
      font-weight: 500;
      opacity: 0.9;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
`;

const StatNumber = styled.div`
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 0.3rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  opacity: 0.8;
  font-weight: 400;
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

    // Filter out projects with status "ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ" for funding calculations
    const projectsForFunding = projects.filter(
      project => project.projectStatus !== 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ'
    );

    // Calculate total funding (excluding completed and paid projects)
    const totalFunding = projectsForFunding.reduce((sum, project) => {
      const amount = parseFloat(project.approvedAmount?.replace(/\./g, '').replace(',', '.')) || 0;
      return sum + amount;
    }, 0);

    // Count project types
    const projectTypes = projects.reduce((acc, project) => {
      const type = project.projectType || 'Άγνωστο';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Count funding sources with funding amounts (excluding completed and paid projects)
    const fundingSources = projectsForFunding.reduce((acc, project) => {
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

  // Chart colors
  const chartColors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
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
      // Shorten long labels
      return source.length > 20 ? source.substring(0, 17) + '...' : source;
    }),
    datasets: [{
      label: 'Χρηματοδότηση (€)',
      data: Object.values(statistics.fundingSources).map(item => item.amount),
      backgroundColor: '#36A2EB',
      borderColor: '#2196F3',
      borderWidth: 1
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
          padding: 15,
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: '#ccc',
        borderWidth: 1
      }
    }
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return formatCurrency(value);
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
        <StatisticsTitle>Στατιστικά Στοιχεία</StatisticsTitle>
        <NoDataMessage>
          Δεν υπάρχουν δεδομένα για την εμφάνιση στατιστικών
        </NoDataMessage>
      </StatisticsContainer>
    );
  }

  return (
    <StatisticsContainer>
      <StatisticsTitle>Στατιστικά Στοιχεία</StatisticsTitle>
      
      <SummaryStats>
        <StatCard color="#4CAF50" darkColor="#45a049">
          <div className="stat-header">
            <span className="stat-icon">🏗️</span>
            <span className="stat-title">Έργα</span>
          </div>
          <StatNumber>{statistics.uniqueProjects}</StatNumber>
          <StatLabel>Συνολικά Έργα</StatLabel>
        </StatCard>
        
        <StatCard color="#2196F3" darkColor="#1976D2">
          <div className="stat-header">
            <span className="stat-icon">📋</span>
            <span className="stat-title">Υποέργα</span>
          </div>
          <StatNumber>{statistics.totalProjects}</StatNumber>
          <StatLabel>Συνολικά Υποέργα</StatLabel>
        </StatCard>
        
        <StatCard color="#FF9800" darkColor="#F57C00">
          <div className="stat-header">
            <span className="stat-icon">💰</span>
            <span className="stat-title">Χρηματοδότηση</span>
          </div>
          <StatNumber>{formatCurrency(statistics.totalFunding)}</StatNumber>
          <StatLabel>Συνολική Χρηματοδότηση</StatLabel>
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
