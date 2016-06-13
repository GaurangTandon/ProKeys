#**Important cases**:

##**1**
ProKeys assumes that the data being imported has no duplicates inside itself.

##**2**
Assume duplicate snippets `snp`, one present inside `fld`, the other being imported and under `Snippets`. 
Now, when we choose to keep the imported snippets in case of duplicates, the resultant snip `snp` will be present under Snippets (and not under
`fld`, as was the initial case)
**Why this happens?** ProKeys cannot judge where a user might want to place his snip. Imagine if the imported snip was under `fld` and
the existing snip under Snippets, then the user might want to let `snp` remain at its place under `fld`.
Hence, **ProKeys preserves the position of the snippets that are kept.**
