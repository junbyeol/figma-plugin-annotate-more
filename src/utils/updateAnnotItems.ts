import { generateAnnotItemNode, getAnnotWrapperNode, setPluginData, updateAnnotItemsBadgeIndex } from '@/utils/figmaUtils'
import { config } from '@/utils/utils'
import contentBlockToNode from '@/utils/contentBlockToNode'
import createAnnotDiff from '@/utils/createAnnotDiff'


export default ( newAnnots: Annotation[], oldAnnots: Annotation[] ) => {
  const diff = createAnnotDiff(newAnnots, oldAnnots),
        diffContent = diff._

  // console.clear()

  // If there is more then 1 annotation items changed at a time, check if id's have changed,
  // this would mean we have to re-initiate every item, since the order has changed.
  if (diff.changes > 1) {
    const firstItem = diffContent[0]
    if (firstItem.status === 'MODIFIED' && firstItem._.id.status === 'MODIFIED') {
      console.log('Detected a change of the id. This means the order has changed and we now have to re-initiate every item.')
      return
    }
  }

  // Loop through array of diff objects
  for (let i = 0; i < diffContent.length; i++) {
    const annotDiffObj = diffContent[i],
          annotWrapperNode = getAnnotWrapperNode()
    
    switch (annotDiffObj.status) {
      case 'ADDED': {
        const { current: newItem } = annotDiffObj

        // Get index for annotation badge
        const annotationIndex = annotWrapperNode.children.length + 1
        annotWrapperNode.appendChild(generateAnnotItemNode(newItem, annotationIndex))

        break
      }

      case 'MODIFIED': {
        const { _: item } = annotDiffObj

        if (item.isDeleted.current === true)
          _deleteAnnotItem(item, annotWrapperNode)
        else {
          // Update annot item
          const annotNode = <FrameNode>annotWrapperNode.findChild(node => node.name.includes(item.id.current))

          // Save the "real" modified annot item object (wihout diff-things)
          const modifiedItemWithoutDiff = newAnnots[i]
          setPluginData(annotNode, config.annotItemNodePluginDataKey, modifiedItemWithoutDiff)

          let doneChanges = 0

          // Loop through item entries (id, title, content, ...)
          for (let entryName of Object.keys(item)) {
            const { changes, current: newValue } = item[entryName]
            if (!changes)
              continue

            switch (entryName) {
              case 'title':
                const titleNode = <TextNode>annotNode.findOne(node => node.name === 'Header/Text')
                titleNode.characters = newValue.length === 0 ? 'Title' : newValue
                titleNode.opacity = newValue.length === 0 ? .25 : 1
                break
            
              case 'content':
                _handleModifiedItemContent(annotDiffObj, entryName, annotNode)
                break
            }

            console.log(`Detected a change in ${entryName}`)

            doneChanges++
            if (doneChanges === annotDiffObj.changes)
              break
          }
        }

        break
      } // end case 'MODIFIED'
    } // end switch
  } // end for (... of ...)
}


const _deleteAnnotItem = ( deletedItem: any, annotWrapperNode: FrameNode ) => {
  const annotNode = <FrameNode>annotWrapperNode.findChild(node => node.name.includes(deletedItem.id.current))

  annotNode.remove()

  // If the annotWrapper node is empty after removing the itemNode, remove the wrapper too.
  if (annotWrapperNode.children.length === 0)
    annotWrapperNode.remove()

  // Update the badge's indexes
  updateAnnotItemsBadgeIndex(annotWrapperNode)
}


const _handleModifiedItemContent = ( item: any, entryName: string, annotNode: FrameNode ) => {
  const bodyNode = <FrameNode>annotNode.findChild(node => node.name === 'Body')

  const diffObj = item._[entryName],
        contentBlockArr = diffObj._,
        contentBlocksAmount = contentBlockArr.filter(b => b.status !== 'DELETED').length

  let doneContentChanges = 0,
      expectedContentChanges = diffObj.changes,
      figmaNodeListIndex = -1

  for (let i = 0; i < contentBlockArr.length; i++) {
    figmaNodeListIndex++

    const contentBlock = contentBlockArr[i]
    if (!contentBlock.changes)
      continue

    switch (contentBlock.status) {
      case 'ADDED':
        const newContentBlock = _generateSafeAddedContentBlock(contentBlock.current),
              newNode = contentBlockToNode({ contentBlock: newContentBlock, contentBlocksAmount })

        // console.log(`ADDED (line ${i + 1})`, newContentBlock)
        bodyNode.insertChild(figmaNodeListIndex, newNode)
        break
    
      case 'DELETED':
        // console.log(`REMOVED (line ${i + 1})`, contentBlock)
        bodyNode.children[figmaNodeListIndex].remove()
        figmaNodeListIndex--
        break
        
      case 'MODIFIED':
        const modifiedContentBlock = _generateSafeModifiedContentBlock(contentBlock),
              modifiedNode = contentBlockToNode({ contentBlock: modifiedContentBlock, contentBlocksAmount })

        // console.log(`MODIFIED (on line ${i + 1})`, modifiedContentBlock)
        bodyNode.children[figmaNodeListIndex].remove()
        bodyNode.insertChild(figmaNodeListIndex, modifiedNode)
        break
    }

    doneContentChanges++
    if (doneContentChanges === expectedContentChanges)
      break
  }
}


const _generateSafeAddedContentBlock = ( contentBlock: any ) => {
  return { 
    ...contentBlock, 
    content: contentBlock?.content 
      ? JSON.parse(contentBlock.content) // when content is already something
      : config.defaultParagraphBlockContent // when content is undefined
  }
}


const _generateSafeModifiedContentBlock = ( contentBlock: any ) => {
  return {
    type: contentBlock._.type.current,
    content: contentBlock._.content.current
      ? JSON.parse(contentBlock._.content.current) // when content is already something
      : config.defaultParagraphBlockContent // when content is undefined
  }
}