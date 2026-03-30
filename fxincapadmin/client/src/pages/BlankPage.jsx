import React from 'react'
import { Breadcrumb } from '../components/Breadcrumb'
import { Card } from '../components/Card'

export const BlankPage = () => {
  return (
    <>
      <Breadcrumb items={['Blank page', 'Sample Page', 'Blank page']} />
      <Card
        title="Title"
        footer="Footer"
      >
        This is some text within a card block.
      </Card>
    </>
  )
}
