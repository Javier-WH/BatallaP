import React, { useState, useCallback } from 'react';
import { Slider, Input, Button, Typography, Popconfirm, message, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface LetterGrade {
  letter: string;
  max: number;
}

interface LetterGradeSliderProps {
  value?: LetterGrade[];
  onChange?: (value: LetterGrade[]) => void;
  maxGrade?: number;
}

const LetterGradeSlider: React.FC<LetterGradeSliderProps> = ({ 
  value = [], 
  onChange, 
  maxGrade = 20 
}) => {
  const [grades, setGrades] = useState<LetterGrade[]>(value.length > 0 ? value : [
    { letter: 'A', max: 20 },
    { letter: 'B', max: 15 },
    { letter: 'C', max: 10 },
    { letter: 'D', max: 5 },
    { letter: 'E', max: 0 }
  ]);

  const updateGrades = useCallback((newGrades: LetterGrade[]) => {
    setGrades(newGrades);
    onChange?.(newGrades);
  }, [onChange]);

  const handleSliderChange = (values: number[]) => {
    // Slider returns values in ascending order, need to map them to grades sorted by max
    const sortedGrades = [...grades].sort((a, b) => a.max - b.max);
    const newGrades = sortedGrades.map((grade, index) => ({
      ...grade,
      max: values[index] !== undefined ? values[index] : grade.max
    }));
    updateGrades(newGrades);
  };

  const handleLetterChange = (index: number, newLetter: string) => {
    const newGrades = [...grades];
    newGrades[index].letter = newLetter;
    updateGrades(newGrades);
  };

  const handleAddLetter = () => {
    if (grades.length >= 10) {
      message.warning('Máximo 10 letras permitidas');
      return;
    }
    
    // Find the smallest gap to insert the new letter
    const sortedGrades = [...grades].sort((a, b) => b.max - a.max);
    let bestInsertIndex = 0;
    let maxGap = 0;
    
    for (let i = 0; i < sortedGrades.length - 1; i++) {
      const gap = sortedGrades[i].max - sortedGrades[i + 1].max;
      if (gap > maxGap) {
        maxGap = gap;
        bestInsertIndex = i;
      }
    }
    
    const insertValue = Math.floor((sortedGrades[bestInsertIndex].max + sortedGrades[bestInsertIndex + 1].max) / 2);
    const newLetter = String.fromCharCode(65 + grades.length); // A, B, C, ...
    
    const newGrades = [...grades, { letter: newLetter, max: insertValue }];
    updateGrades(newGrades);
  };

  const handleRemoveLetter = (index: number) => {
    if (grades.length <= 2) {
      message.warning('Mínimo 2 letras requeridas');
      return;
    }
    
    const newGrades = grades.filter((_, i) => i !== index);
    updateGrades(newGrades);
  };

  // Get slider marks based on grades
  const getSliderMarks = () => {
    const marks: Record<number, string> = {};
    grades.forEach((grade) => {
      marks[grade.max] = grade.letter;
    });
    return marks;
  };

  // Get slider values (sorted ascending for Slider component)
  const getSliderValues = () => {
    return grades.map(g => g.max).sort((a, b) => a - b);
  };

  // Calculate range display for each grade
  const getRangeDisplay = (index: number): string => {
    const sortedGrades = [...grades].sort((a, b) => b.max - a.max);
    const current = sortedGrades[index];
    const next = sortedGrades[index + 1];
    
    if (next) {
      return `${next.max + 1} - ${current.max}`;
    } else {
      return `0 - ${current.max}`;
    }
  };

  const sortedGrades = [...grades].sort((a, b) => b.max - a.max);

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text strong style={{ fontSize: 14 }}>Calificación con Letras</Text>
        <Tooltip title="Configure qué nota numérica equivale a cada letra. Si una nota está en el límite, se asigna a esa letra.">
          <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
        </Tooltip>
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 24, padding: '0 12px' }}>
        <Slider
          range
          min={0}
          max={maxGrade}
          value={getSliderValues()}
          onChange={handleSliderChange}
          marks={getSliderMarks()}
          step={1}
          tooltip={{ formatter: (value) => `${value} pts` }}
        />
      </div>

      {/* Grade List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedGrades.map((grade, index) => {
          const originalIndex = grades.indexOf(grade);
          return (
            <div
              key={originalIndex}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: index % 2 === 0 ? '#fafafa' : '#fff',
                borderRadius: 8,
                border: '1px solid #f0f0f0'
              }}
            >
              <div style={{ width: 60 }}>
                <Input
                  value={grade.letter}
                  onChange={(e) => handleLetterChange(originalIndex, e.target.value.toUpperCase())}
                  maxLength={2}
                  style={{ 
                    textAlign: 'center', 
                    fontWeight: 700,
                    height: 36,
                    borderRadius: 8
                  }}
                />
              </div>
              
              <div style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: '#595959' }}>
                  Rango: <Text strong>{getRangeDisplay(index)}</Text> puntos
                </Text>
              </div>

              <div style={{ width: 80, textAlign: 'right' }}>
                <Text strong style={{ fontSize: 16, color: '#262626' }}>
                  {grade.max}
                </Text>
                <Text style={{ fontSize: 11, color: '#8c8c8c', marginLeft: 2 }}>pts</Text>
              </div>

              <Popconfirm
                title="Eliminar letra"
                description="¿Está seguro de eliminar esta letra?"
                onConfirm={() => handleRemoveLetter(originalIndex)}
                okText="Eliminar"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  disabled={grades.length <= 2}
                  style={{ borderRadius: 6 }}
                />
              </Popconfirm>
            </div>
          );
        })}
      </div>

      {/* Add Button */}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAddLetter}
        block
        style={{ 
          marginTop: 16, 
          borderRadius: 8,
          height: 40,
          fontWeight: 600,
          borderStyle: 'dashed'
        }}
        disabled={grades.length >= 10}
      >
        Agregar Letra
      </Button>
    </div>
  );
};

export default LetterGradeSlider;
